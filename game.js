/* ======================================================
   EL BRUJO DEL GATO — RPG NARRATIVO v3.0
   game.js

   Historia original de Lucas Cabrera.

   ÍNDICE:
   1.  Estado del jugador
   2.  Máquina de estados
   3.  Flags de decisiones
   4.  Estado del combate
   5.  ENEMIES — criaturas regulares
   6.  BOSSES  — jefes con dos fases
   7.  SCENES  — todas las escenas
   8.  Motor de escenas
   9.  Helpers de combate
   10. Sistema de combate (combatAction)
   11. IA de enemigos especiales
   12. IA del jefe final fase 2
   13. IA de la bruja fase 2
   14. Transición de fase
   15. Fin de combate
   16. UI de combate
   17. Stats y notificaciones
   18. Reinicio e inicialización
   ====================================================== */


/* ======================================================
   1. ESTADO DEL JUGADOR
   ====================================================== */
const player = {
  vida:        100,
  vidaMax:     100,
  oro:         5,       // novato — primer contrato, casi sin dinero
  experiencia: 0,
  nivel:       1,
  vendas:      2,       // vendas para curar al jugador o NPCs en diálogos
};


/* ======================================================
   2. MÁQUINA DE ESTADOS
   ====================================================== */
const gameState = {
  actual:   'narrativa',
  anterior: 'narrativa',
};

function setState(nuevoEstado) {
  gameState.anterior = gameState.actual;
  gameState.actual   = nuevoEstado;
}


/* ======================================================
   3. FLAGS — MEMORIA DE DECISIONES
   ====================================================== */
const flags = {};

function setFlag(clave, valor = true) {
  flags[clave] = valor;
}

function getFlag(clave) {
  return !!flags[clave];
}


/* ======================================================
   4. ESTADO DEL COMBATE
   ====================================================== */
const combat = {
  activo:           false,
  enemigo:          null,
  enemigoVida:      0,
  bossKey:          '',     // 'bruja_boss' | 'jefe_final' | ''

  esquivandoJugador: false,

  // Señales — cooldowns (turnos restantes)
  igniCooldown:  0,
  quenCooldown:  0,
  yrdenCooldown: 0,
  aardCooldown:  0,

  // Efectos activos sobre el jugador
  sangradoTurnos: 0,
  sangradoDaño:   3,
  stunTurnos:     0,
  quenActivo:     false,

  // Igni — quemadura al enemigo
  burnTurnos: 0,
  burnDaño:   6,

  // Yrden — trampa que materializa espectros
  yrdenActivo: false,
  yrdenTurnos: 0,

  // Mecánicas del enemigo
  enemigoEsquivando:   false,
  stunEnemigoTurnos:   0,

  // Destinos post-combate
  escenaVictoria: '',
  escenaMuerte:   'muerte',

  // Estado del jefe
  esBoss:       false,
  faseActual:   1,
  enTransicion: false,

  // Combate dual — bruja fase 2 (bruja + ghoul)
  tieneDosEnemigos: false,
  targetActual:     1,    // 1 = enemigo principal, 2 = enemigo secundario
  enemigo2:         null,
  enemigoVida2:     0,
};


/* ======================================================
   5. ENEMIES — criaturas regulares
   ====================================================== */
const ENEMIES = {

  ghoul: {
    nombre:       "Ghoul",
    vidaMax:      40,
    ataqueMin:    8,
    ataqueMax:    14,
    velocidad:    0.10,
    defensa:      0,
    critChance:   0.10,
    critMult:     1.6,
    visual:       "👹",
    retrato:      "assets/portraits/enemies/ghoul.png",
    descripcion:  "Una criatura que desentierra cadáveres. Movimientos torpes pero fuerza notable. — TUTORIAL: Rápido (inevitable), Pesado (esquivable), Esquivar (contra-ataque bajo), Quen (escudo próximo golpe), Yrden (materializa espectros), Aard (stun 1 turno), Igni (fuego+quemadura). 🩹 Venda cura vida.",
    recompensaOro: 0,
    recompensaExp: 25,
  },

  lobo_maldito: {
    nombre:       "Lobo Maldito",
    vidaMax:      55,
    ataqueMin:    10,
    ataqueMax:    18,
    velocidad:    0.25,
    defensa:      2,
    critChance:   0.15,
    critMult:     1.8,
    visual:       "🐺",
    retrato:      "assets/portraits/enemies/lobo-ataque.png",
    tipoEnemigo:  'lobo',
    descripcion:  "Sus ojos brillan con luz propia. Mordida (sangrado 3 turnos). Abalanzarse (stun 1 turno, bloqueado por Quen).",
    recompensaOro: 15,
    recompensaExp: 45,
  },

  espectro: {
    nombre:       "Espectro",
    vidaMax:      45,
    ataqueMin:    14,
    ataqueMax:    24,
    velocidad:    0.30,
    defensa:      0,
    critChance:   0.15,
    critMult:     1.7,
    visual:       "👻",
    retrato:      "assets/portraits/enemies/espectro.png",
    tipoEnemigo:  'espectro',
    esEtereo:     true,
    descripcion:  "⚠️ INTANGIBLE sin Yrden. Activá Yrden en el PRIMER turno o ningún ataque funcionará. Yrden dura 3 turnos — volvé a activarlo cuando se acabe.",
    recompensaOro: 10,
    recompensaExp: 55,
  },

};


/* ======================================================
   6. BOSSES — jefes con dos fases

   Cada boss tiene: esBoss, umbralFase2, fase1, fase2.
   La transición ocurre cuando la vida de fase 1 cae
   por debajo de umbralFase2 (fracción 0–1).
   ====================================================== */
const BOSSES = {

  /* ── BRUJA DEL CEMENTERIO ─────────────────────────── */
  bruja_boss: {
    esBoss:      true,
    umbralFase2: 0.40,   // fase 2 al llegar al 40% de vida

    fase1: {
      nombre:      "Bruja Sepulcral",
      vidaMax:     75,
      ataqueMin:   10,
      ataqueMax:   20,
      velocidad:   0.20,
      defensa:     2,
      critChance:  0.15,
      critMult:    1.8,
      visual:      "🧙‍♀️",
      retrato:     "assets/portraits/enemies/bruja-sepulcral.png",
      descripcion: "Sus ojos brillan verde enfermizo. Controla ghouls mediante cadenas. Por ahora está sola.",
    },

    fase2: {
      nombre:      "Bruja + Ghoul",
      vidaMax:     55,
      ataqueMin:   14,
      ataqueMax:   26,
      velocidad:   0.15,
      defensa:     2,
      critChance:  0.18,
      critMult:    1.9,
      visual:      "🧙‍♀️",
      retrato:     "assets/portraits/enemies/bruja-sepulcral.png",
      descripcion: "Invocó a su ghoul. Ahora luchás contra las dos criaturas al mismo tiempo.",
      recompensaOro: 30,
      recompensaExp: 70,
      stunTransicion: true,    // stun al jugador al entrar en fase 2
      habilidades:    ['atacar', 'ghoul_embiste', 'hechizo_oscuro'],
      probabilidades: [  0.40,       0.35,             0.25       ],
    },
  },

  /* ── LA FIGURA MISTERIOSA / BRUJO MUTADO ──────────── */
  jefe_final: {
    esBoss:      true,
    umbralFase2: 0.50,   // fase 2 al llegar al 50% (se quita la capucha)

    fase1: {
      nombre:      "La Figura Misteriosa",
      vidaMax:     80,
      ataqueMin:   14,
      ataqueMax:   24,
      velocidad:   0.30,
      defensa:     3,
      critChance:  0.18,
      critMult:    1.9,
      visual:      "🗡️",
      retrato:     "assets/portraits/enemies/figura-extraña.png",
      descripcion: "Solo un ojo izquierdo amarillo en la oscuridad. Se mueve demasiado rápido para ser humano. El medallón en tu cuello vibra como nunca antes.",
    },

    fase2: {
      nombre:      "El Brujo Mutado",
      vidaMax:     70,
      ataqueMin:   12,
      ataqueMax:   26,
      velocidad:   0.15,
      defensa:     4,
      critChance:  0.25,
      critMult:    2.0,
      visual:      "🧙",
      retrato:     "assets/portraits/enemies/gael.png",
      descripcion: "Ya no se esconde. Su cara es mitad humana, mitad monstruosa. Usa señales — las reconocés de tu propio gremio.",
      recompensaOro: 80,
      recompensaExp: 150,
      habilidades:    ['atacar', 'señal',  'curar', 'esquivar_activo'],
      probabilidades: [  0.40,    0.30,    0.15,        0.15         ],
      umbralCuracionEmergencia: 0.20,
    },
  },

};


/* ======================================================
   7. SCENES — Todas las escenas del juego

   texto puede ser string o función () => string.
   Las funciones se evalúan al cargar la escena
   para poder usar flags en el texto dinámicamente.
   ====================================================== */
const SCENES = {

  /* ── LLEGADA AL PUEBLO ─────────────────────────────── */
  llegada_pueblo: {
    id:     'llegada_pueblo',
    titulo: "El Pueblo de Nadie",
    imagen: "fondo-aldea",
    texto:
`Meses buscando un contrato. Otro pueblo más en el horizonte.

Al acercarte ves el tablón de anuncios junto a la entrada.
Vacío. Como todos los anteriores.

Mirás tu bolsa. Cinco orens. Suficiente para un vino barato
y para quedarte a dormir en el suelo de alguna taberna.

La taberna está enfrente. Al menos podés sentarte.`,
    onEnter: () => applyEffect({ exp: 5 }),
    opciones: [
      {
        texto: "🍺 Entrar a la taberna",
        siguienteEscena: 'taberna',
      },
    ],
  },

  /* ── TABERNA ────────────────────────────────────────── */
  taberna: {
    id:     'taberna',
    titulo: "La Taberna",
    imagen: "fondo-taberna",
    texto:
`Al quitarte la capucha sentís el desprecio inmediato.
Murmullos. "Un mutante." "Otro inútil más."

Te acercás a la barra. El tabernero te mira con recelo y dice,
sin que se lo pidas: "Otro bicho raro."

Pedís el vino más barato. Mientras lo sirve, esa palabra
te queda dando vueltas. *Otro.*

Le preguntás qué quiso decir con eso.

El tabernero suspira: "Otro como vos. Tomó el contrato que
el alcalde mandó a poner en el tablón y desapareció."

Hace una pausa. Después agrega, casi para sí mismo:
"Todos por acá creen que ya está muerto. Yo creo que
tomó el dinero y se marchó."

No respondés. Tomás el vino de un solo sorbo, dejás unas monedas
sobre la barra y salís de la taberna.

El alcalde. Hay que encontrar al alcalde.`,
    onEnter: () => applyEffect({ exp: 5 }),
    opciones: [
      {
        texto: "🚶 Salir a buscar al alcalde",
        siguienteEscena: 'calle_pueblo',
      },
    ],
  },

  /* ── CALLE DEL PUEBLO ───────────────────────────────── */
  calle_pueblo: {
    id:     'calle_pueblo',
    titulo: "Las Calles Vacías",
    imagen: "fondo-aldea",
    texto:
`Salís de la taberna. La calle principal está desierta.

No hay nadie. Ninguna casa con luz. Ningún animal suelto.
La mitad del pueblo parece abandonado.

A unos treinta metros, casi oculta entre dos casas,
hay una mujer joven tirada contra la pared.
Inmóvil. Pero el pecho le sube y baja.

Tiene la mano apretada sobre el estómago.
Una herida reciente.`,
    opciones: [
      {
        texto: "🩹 Acercarse a la mujer",
        flags: { hablo_aldeana: true },
        siguienteEscena: 'aldeana_dialogo',
      },
      {
        texto: "🚶 Ignorarla — primero el alcalde",
        flags: { ignoro_aldeana: true },
        siguienteEscena: 'cementerio_entrada',
      },
    ],
  },

  /* ── ALDEANA — DIÁLOGO ──────────────────────────────── */
  aldeana_dialogo: {
    id:     'aldeana_dialogo',
    titulo: "La Aldeana Herida",
    imagen: "fondo-aldea",
    texto:
`Al acercarte notás que tiene una herida reciente en el estómago.

Le preguntás cómo ocurrió eso.

"Hay una bruja al otro lado del pueblo, cerca del cementerio.
Está saqueando las tumbas de cadáveres enterrados hace una semana.
Yo la vi anoche. Fui la única que la vio."

Le preguntás si hay algún contrato por matarla.
No trabajás gratis.

"Todavía no. La bruja apareció por primera vez anoche
y nadie más que yo la vio. Pero si la matás,
te prometo una recompensa."`,
    opciones: [
      {
        texto: "🩹 Curarla con una venda y luego ir al cementerio",
        condicion: () => player.vendas > 0,
        efecto: { vendas: -1, exp: 15 },
        flags: { aldeana_curada: true },
        siguienteEscena: 'cementerio_entrada',
      },
      {
        texto: "⚔️ Ir al cementerio",
        flags: { aldeana_sin_curar: true },
        siguienteEscena: 'cementerio_entrada',
      },
    ],
  },

  /* ── CEMENTERIO — ENTRADA / TUTORIAL ───────────────── */
  cementerio_entrada: {
    id:     'cementerio_entrada',
    titulo: "El Cementerio",
    imagen: "fondo-cementerio",
    texto:
`El cementerio está al borde del pueblo, separado por un muro bajo.

Lo que ves te detiene: veinte tumbas recientes por lo menos.
La mitad ya profanadas, la tierra removida.

Tu medallón empieza a vibrar.

De entre las sombras sale una figura encorvada, gris,
trotando con ese movimiento torpe que reconocés de inmediato.

Un ghoul.

⚔️ TUTORIAL — Acciones de combate:
⚡ Rápido: inevitable, daño bajo.  🗡️ Pesado: daño alto, esquivable.
🛡️ Esquivar: contraataque mínimo.  🔵 Quen: escudo (absorbe 1 golpe).
💨 Aard: stun al enemigo 1 turno.  🔥 Igni: fuego + quemadura 3 turnos.
🩹 Venda: curación (gasta 1 venda, turno del enemigo igual ocurre).`,
    opciones: [
      {
        texto: "⚔️ Combatir al ghoul",
        combate: 'ghoul',
        escenaVictoria: 'post_ghoul',
      },
    ],
  },

  /* ── POST GHOUL ─────────────────────────────────────── */
  post_ghoul: {
    id:     'post_ghoul',
    titulo: "Rastro Fresco",
    imagen: "fondo-cementerio",
    texto:
`El ghoul cae.

Seguís investigando el área con tus sentidos de brujo.

A pocos metros detectás señales frescas en una tumba
profanada recientemente. La tierra está removida desde hace horas.

Ves unas huellas extrañas que se alejan entre las lápidas.

Las seguís.`,
    onEnter: () => applyEffect({ exp: 10 }),
    opciones: [
      {
        texto: "🔍 Seguir las huellas",
        siguienteEscena: 'bruja_encuentro',
      },
    ],
  },

  /* ── BRUJA — ENCUENTRO ──────────────────────────────── */
  bruja_encuentro: {
    id:     'bruja_encuentro',
    titulo: "La Bruja Sepulcral",
    imagen: "fondo-cementerio",
    texto:
`Unos sesenta metros desde el cementerio llegás a una zona pantanosa.

Cada paso se vuelve más difícil. El barro te frena,
el aire se vuelve más espeso y frío.

El medallón empieza a vibrar nuevamente.

Aparece la Bruja Sepulcral.

Sacás tu espada de plata.`,
    opciones: [
      {
        texto: "⚔️ Combatir a la Bruja Sepulcral",
        combate: 'bruja_boss',
        escenaVictoria: 'post_bruja',
      },
    ],
  },

  /* ── POST BRUJA ─────────────────────────────────────── */
  post_bruja: {
    id:     'post_bruja',
    titulo: "El Cementerio en Silencio",
    imagen: "fondo-cementerio",
    texto: () =>
`La bruja ya no es una amenaza.

El cementerio quedó en silencio. Solo el viento entre las lápidas.

Sacás la daga de plata. Los brujos del Gato aprenden desde el primer
año: sin prueba, no hay pago. Cortás su cabeza y la envolvés en el
manto que llevaba. Es un trabajo sucio. Pero es el trabajo.

Guardás el trofeo y limpiás la hoja en el pasto.

${getFlag('aldeana_curada')
  ? 'Marta te espera donde la dejaste. Primero ella, después el alcalde.'
  : getFlag('hablo_aldeana')
    ? 'La aldeana herida que encontraste... esperás que haya aguantado.'
    : 'La calle del pueblo sigue tan vacía como cuando llegaste.'}`,
    opciones: [
      {
        texto: "🏘️ Volver donde Marta",
        condicion: () => getFlag('aldeana_curada'),
        siguienteEscena: 'aldeana_sin_recompensa',
      },
      {
        texto: "🏘️ Ver qué pasó con la aldeana herida",
        condicion: () => getFlag('hablo_aldeana') && !getFlag('aldeana_curada'),
        siguienteEscena: 'aldeana_muerta',
      },
      {
        texto: "🏠 Ir directo al alcalde",
        siguienteEscena: 'casa_alcalde',
      },
    ],
  },

  /* ── ALDEANA — SIN RECOMPENSA ───────────────────────── */
  aldeana_sin_recompensa: {
    id:     'aldeana_sin_recompensa',
    titulo: "Sin Recompensa",
    imagen: "fondo-aldea",
    texto:
`Le informás que la bruja ya no va a ser una molestia.

Exigís tu recompensa.

Ella baja la mirada. "Perdón. Te mentí. No tengo nada para darte."

Una pausa larga.

"Perdí a mi esposo y a mis hijos a manos de un hombre bestia,
o algo así. No me quedó nada."

Después levanta la vista. "Pero puedo contarte lo que sé
sobre el contrato que puso el alcalde y lo que pasó acá."`,
    opciones: [
      {
        texto: "👂 Escucharla",
        flags: { escucho_historia: true },
        siguienteEscena: 'aldeana_historia',
      },
      {
        texto: "🚶 No tenés tiempo — ir directo al alcalde",
        siguienteEscena: 'casa_alcalde',
      },
    ],
  },

  /* ── ALDEANA — MUERTA ───────────────────────────────── */
  aldeana_muerta: {
    id:     'aldeana_muerta',
    titulo: "Demasiado Tarde",
    imagen: "fondo-aldea",
    texto:
`Marta no está donde la dejaste.

Hay una mancha oscura en el suelo donde estaba apoyada.
La herida de estómago, sola, de noche... no era difícil deducirlo.

No hay nadie a quien preguntarle adónde fue o qué pasó.
El pueblo sigue vacío.

Solo queda el alcalde.`,
    opciones: [
      {
        texto: "🏠 Ir al alcalde",
        siguienteEscena: 'casa_alcalde',
      },
    ],
  },

  /* ── ALDEANA — HISTORIA ─────────────────────────────── */
  aldeana_historia: {
    id:     'aldeana_historia',
    titulo: "La Figura Encapuchada",
    imagen: "fondo-aldea",
    texto:
`Marta cuenta todo.

Hace 2 meses llegó al pueblo una figura encapuchada
con espadas en la espalda — como un brujo. No se veía la cara.
Solo un ojo izquierdo amarillo, muy brillante.

Estuvo semanas preguntando a todos por el maese Kotlink,
un alquimista que vivía en el pueblo.

El alcalde, cansado por las quejas de los aldeanos que ya no
podían más del miedo y el repudio hacia esa figura, reunió la guardia
— quince soldados armados, siete o diez hombres con antorchas.
Decidido a confrontarlo. Entre ellos, su esposo y su hijo.

La figura habló primero: solo quería a Kotlink, no buscaba problemas.
El capitán lo atacó igual, sin aviso.

La figura frenó la espada del capitán con su mano derecha.
Una mano monstruosa. Rompió el acero como si fuera madera.

Lo llamaron monstruo. Abominación. Mutante asqueroso.

Fue entonces cuando entró en un estado de cólera y frenesí.
En segundos no quedaba nadie de pie. Solo el alcalde,
que salió corriendo en cuanto el comandante atacó.

"Mi esposo era soldado", dice Marta. Voz plana.
"Mi hijo tenía dieciséis años."

Entre lágrimas te señala la casa del alcalde.
Te despedís de Marta y continuás.`,
    onEnter: () => {
      applyEffect({ exp: 30 });
      setFlag('sabe_historia_figura');
    },
    opciones: [
      {
        texto: "🏠 Ir a hablar con el alcalde",
        siguienteEscena: 'casa_alcalde',
      },
    ],
  },

  /* ── CASA DEL ALCALDE ───────────────────────────────── */
  casa_alcalde: {
    id:     'casa_alcalde',
    titulo: "La Casa del Alcalde",
    imagen: "fondo-aldea",
    texto:
`La casa más grande del pueblo, al fondo de la calle principal.
Golpeás la puerta.

Silencio.

Golpeás más fuerte. Un ruido adentro — algo se mueve.
"¡Alcalde! ¡Sé que estás ahí!" Nada.

No tenés tiempo para esto.`,
    onEnter: () => applyEffect({ exp: 10 }),
    opciones: [
      {
        texto: "💨 Señal Aard — tirar la puerta abajo",
        siguienteEscena: 'alcalde_aard',
      },
    ],
  },

  /* ── CASA DEL ALCALDE — TRAS EL AARD ───────────────── */
  alcalde_aard: {
    id:     'alcalde_aard',
    titulo: "La Casa del Alcalde",
    imagen: "fondo-aldea",
    texto:
`La puerta vuela hacia adentro hecha astillas.

Oscuridad total. Olor a vela recién apagada —
alguien la apagó cuando te escuchó llegar.

Activás los sentidos. La vista se adapta. El oído se extiende
hasta los rincones de la casa.

Un latido. Rápido. Asustado. Viene de la cocina.

Un arcón de madera contra la pared. Grande. Cerrado desde adentro.
Lo abrís de un tirón.

Adentro, hecho un ovillo entre mantas y ropa, está el alcalde.

"¡Váyase! ¡Déjeme en paz! Ya tuve suficiente con los de su clase—"

Lo agarrás de las solapas con las dos manos y lo sacás afuera.
Lo plantás en la calle.

Exigís información. Le decís que estás dispuesto a terminar el trabajo
si hay pago. El hombre balbucea, demasiado agitado para articular
una sola palabra coherente.`,
    opciones: [
      {
        texto: "🔵 Señal Axii — calmar su mente",
        clase: 'axii-opcion',
        dialogo: [
          {
            hablante: 'Alcalde',
            retrato:  'assets/portraits/npc/alcalde-axii.png',
            texto:    '...El brujo debería haber vuelto hace cinco días. Pagué por adelantado.',
          },
          {
            hablante: 'Brujo del Gato',
            retrato:  'assets/portraits/npc/protagonista.png',
            texto:    'En la taberna creen que huyó con el dinero.',
          },
          {
            hablante: 'Alcalde',
            retrato:  'assets/portraits/npc/alcalde-axii.png',
            texto:    'Imposible. Dejó su caballo. Ningún brujo abandona su caballo — me lo dijo él mismo. Pidió que en el establo lo cuidaran hasta su regreso. Iba a volver con la cabeza de esa figura.',
          },
          {
            hablante: 'Brujo del Gato',
            retrato:  'assets/portraits/npc/protagonista.png',
            texto:    '¿Adónde se dirigía exactamente?',
          },
          {
            hablante: 'Alcalde',
            retrato:  'assets/portraits/npc/alcalde-axii.png',
            texto:    'Las montañas. Al norte, cruzando el bosque. Dorian — el cazador del pueblo — vio hacia dónde se alejó la figura la primera noche. Acompañó al brujo hasta la mitad del camino para ahorrarle tiempo.',
          },
          {
            hablante: 'Brujo del Gato',
            retrato:  'assets/portraits/npc/protagonista.png',
            texto:    '¿Dorian tampoco volvió?',
          },
          {
            hablante: 'Alcalde',
            retrato:  'assets/portraits/npc/alcalde-fin-del-acto.png',
            texto:    '*Niega lentamente con la cabeza. No dice nada más.*',
          },
        ],
        efecto: { exp: 20 },
        flags: { hablo_alcalde: true },
        siguienteEscena: 'partida_bosque',
      },
    ],
  },

  /* ── PARTIDA AL BOSQUE ──────────────────────────────── */
  partida_bosque: {
    id:     'partida_bosque',
    titulo: "El Camino al Norte",
    imagen: "fondo-aldea",
    texto:
`Tenés todo lo que necesitás saber.

Norte. Cruzar el bosque. Llegar a las montañas.
Un brujo desaparecido, un cazador desaparecido y una figura
que masacró a quince soldados con una sola mano.

Cinco orens en la bolsa. Sin adelanto.
Primer contrato real. Sin margen de error.

Hay que moverse antes de que anochezca.`,
    opciones: [
      {
        texto: "🌲 Entrar al bosque",
        siguienteEscena: 'bosque_noche',
      },
    ],
  },

  /* ── BOSQUE — NOCHE ─────────────────────────────────── */
  bosque_noche: {
    id:     'bosque_noche',
    titulo: "El Bosque",
    imagen: "fondo-bosque-noche",
    texto:
`Media jornada de caminata. El bosque denso.
Ese silencio es siempre una mala señal — algo ronda por las cercanías.

Se hace de noche antes de lo esperado.

Te parás. Activás los sentidos de brujo — la vista se agudiza,
el oído se extiende hasta los límites del claro.

Percibís un olor a sangre. Decidís investigar.

Un ciervo muerto. Un flechazo limpio en el ojo derecho — tiro certero,
de cazador experimentado. Tiene unos cuatro días. Lo que significa
que el cazador estaba vivo hace cuatro días. Quizás todavía lo está.

En el barro: huellas humanas y rastro de una manada de tres lobos.
Todas van hacia el norte. Las seguís.

A unos treinta metros: el primero de los lobos. Muerto.
Flechazo en la cabeza. El cazador siguió moviéndose.

Veinte metros más: el segundo lobo. Este no murió por flecha —
pisó una trampa para osos. Quedó atrapado y se desangró.

Dos lobos muertos, trampas en el camino, flechas precisas.
Es casi seguro que estás siguiendo el rastro de Dorian.

Acá las huellas se bifurcan: las del cazador continúan
hacia el norte. Las del tercer lobo doblan hacia el este.`,
    onEnter: () => applyEffect({ exp: 15 }),
    opciones: [
      {
        texto: "👣 Seguir las huellas del cazador",
        flags: { siguio_huellas_humano: true },
        siguienteEscena: 'huellas_humano',
      },
      {
        texto: "🐺 Seguir las huellas del tercer lobo",
        flags: { siguio_huellas_lobo: true },
        siguienteEscena: 'huellas_lobo',
      },
    ],
  },

  /* ── HUELLAS DEL LOBO — CAMINO EQUIVOCADO ──────────── */
  huellas_lobo: {
    id:     'huellas_lobo',
    titulo: "El Rastro Perdido",
    imagen: "fondo-bosque-noche",
    texto:
`Seguís al lobo hacia el sur, fuera del camino principal.

Media hora después te das cuenta de que te alejaste
demasiado de la dirección de las montañas.

Cuando volvés sobre tus pasos y buscás las huellas humanas,
encontrás algo que no querías encontrar: un rastro de sangre
que se interrumpe cerca de unos robles.

Dorian. El cazador. Perdió demasiada sangre antes de que
pudieras llegar. No te esperó.

La información sobre el paradero del otro brujo murió con él.`,
    onEnter: () => {
      applyEffect({ exp: 5 });
      setFlag('cazador_muerto_por_lobo');
    },
    opciones: [
      {
        texto: "🏔️ Continuar hacia las montañas solo",
        siguienteEscena: 'lobo_aparece',
      },
    ],
  },

  /* ── HUELLAS HUMANAS — CAZADOR INCONSCIENTE ─────────── */
  huellas_humano: {
    id:     'huellas_humano',
    titulo: "El Cazador",
    imagen: "fondo-bosque-noche",
    texto:
`Las huellas te llevan hasta los pies de un árbol enorme.

En una rama a unos tres metros de altura, extendido boca arriba,
está el cazador. Inconsciente. Heridas de garra en el costado
y en un brazo — se defendió bien, pero el tercero lo alcanzó.

Sus latidos llegan a tu oído. Lentos. Cada vez más lentos.

Sin ayuda no va a llegar al amanecer.

Pegás un salto, lo agarrás de los pies y lo jalás hacia abajo.
Amortiguás el impacto sobre tus hombros y lo bajás al suelo
lo más suave que podés. Lo colocás contra el tronco.`,
    opciones: [
      {
        texto: "🩹 Usar una venda para estabilizarlo",
        condicion: () => player.vendas > 0,
        efecto: { vendas: -1, exp: 20 },
        flags: { cazador_curado: true },
        siguienteEscena: 'lobo_aparece',
      },
      {
        texto: "🔥 Sin vendas — hacer una fogata para mantenerlo con vida",
        condicion: () => player.vendas <= 0,
        flags: { cazador_fogata: true },
        siguienteEscena: 'lobo_aparece',
      },
    ],
  },

  /* ── EL LOBO APARECE ────────────────────────────────── */
  lobo_aparece: {
    id:     'lobo_aparece',
    titulo: "El Tercer Lobo",
    imagen: "fondo-bosque-noche",
    texto: () =>
`Entre los árboles aparecen dos ojos. El tercer lobo.
No es magia — es hambre y rabia. Un animal grande,
acorralado, que perdió a su manada y no tiene nada que perder.

El medallón no vibra. No hace falta — esto no es un monstruo.
Es una bestia. Feroz, pero una bestia al fin.

${getFlag('cazador_curado')
  ? 'Con Dorian vendado a tus espaldas, sacás la espada de hierro.'
  : getFlag('cazador_fogata')
    ? 'Dorian sigue junto a la fogata. Sacás la espada de hierro.'
    : 'Solo en el bosque nocturno, sacás la espada de hierro.'}`,
    opciones: [
      {
        texto: "⚔️ Combatir al lobo",
        combate: 'lobo_maldito',
        escenaVictoria: 'campamento',
        flags: { derroto_lobo: true },
      },
    ],
  },

  /* ── CAMPAMENTO ─────────────────────────────────────── */
  campamento: {
    id:     'campamento',
    titulo: "La Fogata",
    imagen: "fondo-campamento",
    texto: () =>
`El lobo cae. Te limpiás la espada en el pasto.

Armás una fogata entre los robles.
Suficiente para dar calor sin llamar atención.

${getFlag('cazador_curado')
  ? 'Colocás a Dorian lo más cerca del fuego que podés. La venda aguanta. Respiración pareja.'
  : getFlag('cazador_fogata')
    ? 'Arrastrás a Dorian junto a la fogata. Las heridas no están tratadas, pero el calor ayuda. Respiración lenta pero presente.'
    : 'El fuego crepita solo. El bosque en silencio.'}

Meditás. La vida vuelve al máximo.

Llevás dos horas apoyado contra el roble más grande
cuando el fuego se apaga solo.

Tu medallón explota en vibraciones.`,
    onEnter: () => {
      player.vida = player.vidaMax;
      applyEffect({ exp: 10 });
      showNotification('🌙 Meditaste junto a la fogata — vida al máximo');
    },
    opciones: [
      {
        texto: "👻 ¿Qué apagó el fuego?",
        siguienteEscena: 'espectro_medianoche',
      },
    ],
  },

  /* ── ESPECTRO DE MEDIANOCHE ──────────────────────────── */
  espectro_medianoche: {
    id:     'espectro_medianoche',
    titulo: "El Espectro",
    imagen: "fondo-campamento",
    texto:
`La figura aparece entre los árboles. O más bien, a través de ellos.

Semitransparente. Se mueve sin tocar el suelo.
Un espectro — un muerto que no sabe que murió, o que sí lo sabe
y eligió quedarse.

Desenvainás y lanzás un tajo. La espada pasa a través de él
como a través del aire. El espectro ni lo registra.

⚠️ ATENCIÓN: Las criaturas etéreas son INTANGIBLES.
Activá Yrden en el PRIMER turno para materializarlo.
Sin Yrden activo, NINGÚN ataque ni señal funcionará.
Yrden dura 3 turnos — volvé a activarlo cuando se acabe.`,
    opciones: [
      {
        texto: "⚔️ Combatir al espectro (¡Yrden primero!)",
        combate: 'espectro',
        escenaVictoria: 'amanecer',
        flags: { derroto_espectro: true },
      },
    ],
  },

  /* ── AMANECER ────────────────────────────────────────── */
  amanecer: {
    id:     'amanecer',
    titulo: "El Amanecer",
    imagen: "fondo-amanecer",
    texto: () =>
`Acabás con el espectro. Se disuelve lentamente con la primera luz.
Quedás golpeado pero vivo.

Volvés a la fogata y la encendés de nuevo. Meditás hasta que el sol sube.
La vida vuelve al máximo.

${(getFlag('cazador_curado') || getFlag('cazador_fogata'))
  ? `Dorian despierta una hora después. Asustado y desorientado
al principio — al ver el lobo muerto, entiende lo que pasó.

"¿Cuánto tiempo pasé inconsciente?"

Le preguntás por el otro brujo. Sus ojos se aclaran.

"Lo acompañé hasta la mitad del bosque. Me dijo que volviera,
que era trabajo para él solo." Hace una pausa. "No discutí."

"Al volver quise aprovechar y cazar algo para llevar a casa.
Encontré un ciervo. Con la mala suerte de que no era
el único que lo intentaba."

Ahí relata el encuentro con los lobos.

Te da la dirección exacta.

${getFlag('cazador_curado')
  ? `"Gracias", dice en voz baja, mirando la venda.
No hace falta responder nada.`
  : `Te mira un momento. No dice nada más.`}`
  : `El bosque amanece solo.
Sin Dorian, vas a tener que buscar la cueva por tu cuenta.
El medallón te va a guiar.`}`,
    onEnter: () => {
      player.vida = player.vidaMax;
      applyEffect({ exp: getFlag('cazador_curado') ? 40 : 20 });
      showNotification('🌅 Amanecer — vida al máximo');
    },
    opciones: [
      {
        texto: "🏔️ Partir hacia las montañas",
        siguienteEscena: 'cueva_exterior',
      },
    ],
  },

  /* ── CUEVA — EXTERIOR ────────────────────────────────── */
  cueva_exterior: {
    id:     'cueva_exterior',
    titulo: "Las Montañas",
    imagen: "fondo-cueva",
    texto: () =>
`Medio día de caminata más hacia la montaña.

${getFlag('cazador_curado') || getFlag('cazador_fogata')
  ? `Con la dirección de Dorian encontrás sin esfuerzo algunas huellas,
y un vial de poción tirado en el suelo.

Seguís las huellas con tus sentidos de brujo.
A pocos metros lográs ver a lo lejos lo que parece
la entrada de una cueva.`
  : `Sin información exacta tardás más, pero los sentidos de brujo
no fallan. Huellas en el suelo, olor a elixires rancios.
A lo lejos, la entrada de una cueva.`}

Bebés la poción Gato Negro. La oscuridad de la cueva
deja de ser oscuridad.`,
    onEnter: () => applyEffect({ exp: 15 }),
    opciones: [
      {
        texto: "🕯️ Entrar",
        siguienteEscena: 'cueva_interior',
      },
    ],
  },

  /* ── CUEVA — INTERIOR / LABORATORIO ─────────────────── */
  cueva_interior: {
    id:     'cueva_interior',
    titulo: "El Laboratorio",
    imagen: "fondo-laboratorio",
    texto:
`La oscuridad de los primeros metros cede a algo inesperado.

Viales. Decenas de viales. Después centenas. Fórmulas escritas
en las paredes con carbón y con cosas que preferís no identificar.
Mesas de trabajo improvisadas con instrumentos que reconocés
de los libros del gremio.

Y en el fondo, un cadáver.

El medallón que lleva te lo dice antes de acercarte:
Escuela del Oso. La armadura gruesa, el físico enorme
incluso en la muerte, el símbolo del oso en el pecho.

El otro brujo.`,
    onEnter: () => applyEffect({ exp: 20 }),
    opciones: [
      {
        texto: "🔍 Investigar el cadáver con cuidado (+exp)",
        efecto: { exp: 20 },
        flags: { investigo_cadaver: true },
        siguienteEscena: 'encuentro_figura',
      },
      {
        texto: "⚔️ No perder tiempo — algo sigue aquí",
        siguienteEscena: 'encuentro_figura',
      },
    ],
  },

  /* ── ENCUENTRO CON LA FIGURA ──────────────────────────── */
  encuentro_figura: {
    id:     'encuentro_figura',
    titulo: "La Figura",
    imagen: "fondo-laboratorio",
    texto:
`Tu medallón explota.

Sentís la presencia antes de verla. Oscura, hostil,
llenando la cueva completa.

La figura se tira desde las sombras del techo.
Velocidad imposible. Apenas la seguís con la vista.

Intentás hablar: "Espera — ¿de dónde sacaste estos secretos del gremio? ¿Cómo—?"

"Silencio. No hablaré... ya no más." Voz ronca, rota, mezclada con algo
no del todo humano. "Nunca más."

Desenvainás tu espada.

El combate comienza.`,
    flags: { intento_dialogar_jefe: true },
    opciones: [
      {
        texto: "⚔️ Combatir a la figura misteriosa",
        combate: 'jefe_final',
        escenaVictoria: 'confrontacion_final',
      },
    ],
  },

  /* ── CONFRONTACIÓN FINAL ──────────────────────────────── */
  confrontacion_final: {
    id:     'confrontacion_final',
    titulo: "El Brujo Caído",
    imagen: "fondo-laboratorio",
    texto:
`Está arrodillado en el suelo. Su forma oscila.

Por primera vez, sus ojos no tienen locura. Solo cansancio.
Un cansancio que tiene décadas de profundidad.

"Yo tenía tu edad cuando dejé el gremio en busca de mi primer contrato.
Hace más de setenta inviernos."

Y empieza a murmurar.

Hace veinte años acepté un contrato de un hechicero —
sangre de kikimora, algo simple. Al entregarlo, el hechicero
me pasó a su laboratorio con la kikimora. Con un hechizo me neutralizó
quedando inconsciente. Cuando desperté: encadenado. Desnudo.
Ya era demasiado tarde.

Tras años de experimentos con mutágenos en mi cuerpo...
solo podía esperar la muerte.
Hasta que un día mi brazo mutó.
Con una fuerza lo suficiente para romper las cadenas.

Escapé. Y me transformé en las cosas que debía cazar.

"Estuve buscando al hechicero para matarlo durante años.
Cuando por fin pude tomar mi venganza, él me habló
de un hombre que podría ayudarme — Kotlink. El alquimista,
experto en mutágenos. Vivía en este pueblo."

Tose sangre negra.

"No busqué lo que pasó en el pueblo. Solo quería
encontrar algo que me libere de mi tormento. Y los humanos..."

No termina la frase. No hace falta.`,
    onEnter: () => applyEffect({ exp: 50, oro: 40 }),
    opciones: [
      {
        texto: "⚔️ Matarlo — ya ha sufrido demasiado",
        siguienteEscena: 'final_matar',
      },
      {
        texto: "🕊️ Dejarlo vivir — ofrecerle ayuda",
        flags: { perdono_jefe: true },
        siguienteEscena: 'final_perdonar',
      },
    ],
  },

  /* ── FINAL A: EL DEBER CUMPLIDO ───────────────────────── */
  final_matar: {
    id:     'final_matar',
    titulo: "El Contrato Cumplido",
    imagen: "fondo-amanecer",
    texto:
`La espada de acero hace su trabajo.

Él no forcejea. Cierra los ojos con algo que parece alivio —
como si llevara décadas esperando que alguien tomara
esa decisión por él.

Revisás el cadáver del brujo del Oso.
Te llevás tu merecida recompensa.

Volvés al pueblo con la prueba del contrato cumplido.
El alcalde te ofrece que te lleves el caballo del brujo del Oso.

Salís del pueblo montado por primera vez en meses.
Primer contrato terminado.

No sabés si lo que hiciste hoy fue lo correcto.
Pero el camino del Gato no espera esas respuestas.

Continuás cabalgando mientras te alejás de ese pueblo
hacia tu próximo contrato.

═════════════════════════════════════════════
    🎮 FIN — "El Precio del Experimento"
         FINAL A: El Deber Cumplido
═════════════════════════════════════════════`,
    onEnter: () => applyEffect({ exp: 30, oro: 30 }),
    opciones: [
      { texto: "🔄 Jugar de nuevo", siguienteEscena: '__reiniciar__' },
    ],
  },

  /* ── FINAL B: LA COMPASIÓN DEL GATO ──────────────────── */
  final_perdonar: {
    id:     'final_perdonar',
    titulo: "La Balanza",
    imagen: "fondo-amanecer",
    texto:
`Le ofrecés buscar al alquimista. Pero con una condición:
primero regresan juntos al gremio. Él se entrega bajo custodia
hasta que vuelvas con Kotlink. Que confíe en uno de los suyos.

Te mira como si no supiera qué hacer con eso.

"¿Por qué?"

No respondés de inmediato. Después:

"Ya se causó demasiada muerte. El mundo está lleno de monstruos.
Debemos volver a equilibrar la balanza."

Sacás la daga. Te acercás al cadáver del brujo del Oso.
Le cortás el cuello. Quemás la mitad de su rostro
para que no lo puedan reconocer.

En el pueblo van a creer que mataste a la figura extraña.

Quemás el resto del cadáver.

Le pedís que espere en la cueva hasta que vuelvas en unos días.
Salís sin decir más.

Volvés al pueblo. Le decís al alcalde que la amenaza terminó.
Sin detalles. Se lo cree porque quiere creerlo.

"El caballo del brujo es tuyo por el trabajo", dice el alcalde.

Le pedís algo más — una carreta y provisiones.
Cansado de todo, el alcalde no tiene otra que acceder.

Volvés a la cueva. Buscás a Gael.
Lo llevás de vuelta al gremio.

Esperando no morir en el intento.

═════════════════════════════════════════════
    🎮 FIN — "El Precio del Experimento"
       FINAL B: La Balanza del Gato
═════════════════════════════════════════════`,
    onEnter: () => applyEffect({ exp: 60 }),
    opciones: [
      { texto: "🔄 Jugar de nuevo", siguienteEscena: '__reiniciar__' },
    ],
  },

  /* ── MUERTE ───────────────────────────────────────────── */
  muerte: {
    id:     'muerte',
    titulo: "El Gato Cae",
    imagen: "fondo-muerte",
    texto:
`La Escuela del Gato entrena para no fallar.
Esta vez fallaste.

La oscuridad llega rápido. Al menos eso tienen los brujos
del Gato — saben exactamente cuándo una batalla está perdida.

El último flash antes de que todo se apague:
la figura sobre vos. Por un momento, sus ojos
tienen algo parecido al lamento.

Después desaparece. El contrato quedó sin cumplir.
El pueblo de nadie sigue esperando.

═══════════════════════════
    💀 FIN — Misión Fallida
═══════════════════════════`,
    opciones: [
      { texto: "🔄 Volver a intentarlo", siguienteEscena: '__reiniciar__' },
    ],
  },

};


/* ======================================================
   8. MOTOR DE ESCENAS
   ====================================================== */

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

  setState('narrativa');

  combat.activo = false;
  document.getElementById('combat-panel').classList.add('hidden');
  document.getElementById('scene-panel').classList.remove('hidden');

  // Fade suave del fondo
  const bg = document.getElementById('scene-bg');
  bg.style.opacity = '0';
  setTimeout(() => {
    bg.className     = scene.imagen || 'fondo-taberna';
    bg.style.opacity = '1';
    if (typeof updateEffects === 'function') updateEffects(scene.imagen);
  }, 350);

  document.getElementById('scene-title').textContent = scene.titulo;

  // texto puede ser string o función (para usar flags en tiempo de carga)
  const textoStr = typeof scene.texto === 'function' ? scene.texto() : scene.texto;
  document.getElementById('scene-text').textContent = textoStr;

  // Flags del onEnter de la propia escena (no de opciones)
  if (scene.flags) {
    Object.entries(scene.flags).forEach(([k, v]) => setFlag(k, v));
  }

  if (typeof scene.onEnter === 'function') scene.onEnter();

  renderOptions(scene.opciones || []);
  updateStats();

  const panel = document.getElementById('scene-panel');
  panel.classList.remove('fade-in');
  void panel.offsetWidth;
  panel.classList.add('fade-in');
}

function renderOptions(opciones) {
  const container = document.getElementById('scene-options');
  container.innerHTML = '';

  opciones.forEach((opcion) => {
    if (typeof opcion.condicion === 'function' && !opcion.condicion()) return;

    const btn = document.createElement('button');
    btn.className   = 'btn-opcion' + (opcion.clase ? ' ' + opcion.clase : '');
    btn.textContent = opcion.texto;

    btn.addEventListener('click', () => {
      if (gameState.actual !== 'narrativa') return;

      if (opcion.efecto) applyEffect(opcion.efecto);

      if (opcion.flags) {
        Object.entries(opcion.flags).forEach(([k, v]) => setFlag(k, v));
      }

      if (opcion.dialogo) {
        const siguiente = opcion.siguienteEscena;
        const combKey   = opcion.combate;
        startDialogue(opcion.dialogo, () => {
          if (combKey) {
            startCombat(combKey, opcion.escenaVictoria || 'muerte', opcion.dañoInicial || 0);
          } else if (siguiente) {
            loadScene(siguiente);
          }
        });
      } else if (opcion.combate) {
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

  if (efecto.vendas !== undefined) {
    const antes   = player.vendas;
    player.vendas = Math.max(0, player.vendas + efecto.vendas);
    const delta   = player.vendas - antes;
    if (delta > 0) partes.push(`+${delta} 🩹`);
    if (delta < 0) partes.push(`${delta} 🩹`);
  }

  updateStats();
  if (partes.length > 0) showNotification(partes.join('   '));
}

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
   9. HELPERS DE COMBATE
   ====================================================== */

function calcularDaño(min, max, critChance = 0.15, critMult = 1.8) {
  const base      = Math.floor(Math.random() * (max - min + 1)) + min;
  const esCritico = Math.random() < critChance;
  const daño      = esCritico ? Math.floor(base * critMult) : base;
  return { daño, esCritico };
}

function verificarEsquiva(velocidad = 0) {
  return Math.random() < velocidad;
}


/* ======================================================
   10. SISTEMA DE COMBATE
   ====================================================== */

function startCombat(enemigoKey, escenaVictoria, dañoInicial = 0) {
  let enemigo;

  if (BOSSES[enemigoKey]) {
    combat.esBoss     = true;
    combat.bossKey    = enemigoKey;
    combat.faseActual = 1;
    enemigo           = BOSSES[enemigoKey].fase1;
  } else {
    combat.esBoss  = false;
    combat.bossKey = '';
    enemigo        = ENEMIES[enemigoKey];
    if (!enemigo) {
      console.error(`[game] Enemigo no encontrado: "${enemigoKey}"`);
      return;
    }
  }

  setState('combate');
  combat.activo            = true;
  combat.enemigo           = enemigo;
  combat.enemigoVida       = Math.max(1, enemigo.vidaMax - dañoInicial);
  combat.escenaVictoria    = escenaVictoria;
  combat.esquivandoJugador = false;
  combat.enemigoEsquivando = false;
  combat.stunEnemigoTurnos = 0;
  combat.igniCooldown      = 0;
  combat.quenCooldown      = 0;
  combat.yrdenCooldown     = 0;
  combat.aardCooldown      = 0;
  combat.burnTurnos        = 0;
  combat.sangradoTurnos    = 0;
  combat.stunTurnos        = 0;
  combat.quenActivo        = false;
  combat.yrdenActivo       = false;
  combat.yrdenTurnos       = 0;
  combat.enTransicion      = false;
  combat.tieneDosEnemigos  = false;
  combat.targetActual      = 1;
  combat.enemigo2          = null;
  combat.enemigoVida2      = 0;

  ocultarSegundoEnemigo();

  document.getElementById('scene-panel').classList.add('hidden');
  document.getElementById('combat-panel').classList.remove('hidden');
  document.getElementById('combat-panel').classList.remove('boss-fase2');

  const enemyVisualEl = document.getElementById('enemy-visual');
  if (enemigo.retrato) {
    enemyVisualEl.innerHTML = '';
    const imgEnemigo = document.createElement('img');
    imgEnemigo.alt   = enemigo.nombre;
    imgEnemigo.style.cssText = 'width:240px;height:300px;object-fit:contain;object-position:center;';
    enemyVisualEl.appendChild(imgEnemigo);
    _setPortrait(imgEnemigo, enemigo.retrato);
  } else {
    enemyVisualEl.textContent = enemigo.visual;
  }
  document.getElementById('enemy-name').textContent = enemigo.nombre;
  document.getElementById('combat-fase').classList.add('hidden');

  ['combat-burn','combat-crit-flash','combat-stun-enemy',
   'combat-sangrado','combat-stun-self','combat-quen-badge','combat-yrden-badge']
    .forEach(id => { const el = document.getElementById(id); if (el) el.classList.add('hidden'); });

  resetIgniButton();
  _actualizarBtnSenal('btn-quen',  'Quen',  0);
  _actualizarBtnSenal('btn-yrden', 'Yrden', 0);
  _actualizarBtnSenal('btn-aard',  'Aard',  0);
  setBotonsCombate(true);

  let msg = enemigo.descripcion;
  if (dañoInicial > 0) msg += ` [Golpe inicial: −${dañoInicial} vida al enemigo.]`;
  setCombatMessage(msg, false);

  updateCombatBars();
  updateStats();
}

function combatAction(accion) {
  if (gameState.actual !== 'combate' || combat.enTransicion) return;

  const msgs = [];
  let dañoAlEnemigo = 0;
  let huboCritico   = false;
  combat.esquivandoJugador = false;

  // Target activo: enemigo principal (1) o secundario (2)
  const targetEnemigo = (combat.tieneDosEnemigos && combat.targetActual === 2)
    ? combat.enemigo2
    : combat.enemigo;

  /* ── SANGRADO DEL JUGADOR ── */
  if (combat.sangradoTurnos > 0) {
    player.vida = Math.max(0, player.vida - combat.sangradoDaño);
    combat.sangradoTurnos--;
    msgs.push(`🩸 Sangrado: −${combat.sangradoDaño} vida. (${combat.sangradoTurnos} turnos restantes)`);
    _actualizarBadgeSangrado();
    if (player.vida <= 0) {
      setCombatMessage(msgs.join(' | ') + ' | 💀 Moriste desangrado...', false);
      updateCombatBars(); updateStats();
      setTimeout(() => endCombat(false), 1800);
      return;
    }
  }

  /* ── STUN DEL JUGADOR — pierde el turno ── */
  if (combat.stunTurnos > 0) {
    combat.stunTurnos--;
    msgs.push(`😵 Estás aturdido — perdés el turno. (${combat.stunTurnos} restantes)`);
    _actualizarBadgeStun();
    const msgsE = turnoEnemigo();
    msgsE.forEach(m => msgs.push(m));
    _decrementarCooldowns();
    setCombatMessage(msgs.join(' | '), false);
    updateCombatBars(); updateStats();
    if (player.vida <= 0) setTimeout(() => endCombat(false), 1800);
    return;
  }

  /* ── BURN AL ENEMIGO (Igni activo) ── */
  if (combat.burnTurnos > 0) {
    combat.enemigoVida = Math.max(0, combat.enemigoVida - combat.burnDaño);
    combat.burnTurnos--;
    msgs.push(`🔥 Quemadura: −${combat.burnDaño} al ${combat.enemigo.nombre}. (${combat.burnTurnos} restantes)`);
    const burnEl = document.getElementById('combat-burn');
    if (combat.burnTurnos > 0) { burnEl.textContent = `🔥 Quemando (${combat.burnTurnos})`; burnEl.classList.remove('hidden'); }
    else                        { burnEl.classList.add('hidden'); }
    if (combat.enemigoVida <= 0) {
      msgs.push(`¡${combat.enemigo.nombre} murió por las llamas!`);
      if (combat.tieneDosEnemigos && combat.enemigoVida2 > 0) {
        // El ghoul sigue vivo — cambiar target
        setCombatMessage(msgs.join(' | '), false); updateCombatBars();
        combat.targetActual = 2;
        actualizarBotonesTarget();
        setCombatMessage(msgs.join(' | ') + ' El ghoul sigue en pie. Apuntás al ghoul.', false);
        updateCombatBars(); updateStats();
        return;
      }
      setCombatMessage(msgs.join(' | '), false); updateCombatBars();
      endCombat(true); return;
    }
  }

  /* ── ACCIÓN DEL JUGADOR ── */
  switch (accion) {

    case 'ataque_rapido': {
      const r = calcularDaño(8, 15, 0.15, 1.6);
      dañoAlEnemigo = r.daño; huboCritico = r.esCritico;
      if (targetEnemigo.esEtereo && !combat.yrdenActivo) {
        msgs.push(`⚡ Tu golpe pasa a través del ${targetEnemigo.nombre}. ¡Necesitás Yrden primero!`);
        dañoAlEnemigo = 0;
      } else if (huboCritico) {
        msgs.push(`⚡ ¡CRÍTICO rápido! ${dañoAlEnemigo} de daño al ${targetEnemigo.nombre}.`);
        mostrarCritico();
      } else {
        msgs.push(`⚡ Golpe rápido: ${dañoAlEnemigo} de daño al ${targetEnemigo.nombre}.`);
      }
      break;
    }

    case 'ataque_pesado': {
      const r = calcularDaño(16, 28, 0.22, 1.95);
      dañoAlEnemigo = r.daño; huboCritico = r.esCritico;
      if (targetEnemigo.esEtereo && !combat.yrdenActivo) {
        msgs.push(`🗡️ Tu espada atraviesa el ${targetEnemigo.nombre} sin efecto. ¡Necesitás Yrden!`);
        dañoAlEnemigo = 0;
      } else if (verificarEsquiva(targetEnemigo.velocidad)) {
        msgs.push(`${targetEnemigo.nombre} esquivó tu golpe pesado.`);
        dañoAlEnemigo = 0;
      } else if (huboCritico) {
        msgs.push(`🗡️⚡ ¡GOLPE CRÍTICO PESADO! ${dañoAlEnemigo} de daño al ${targetEnemigo.nombre}.`);
        mostrarCritico();
      } else {
        msgs.push(`🗡️ Golpe pesado: ${dañoAlEnemigo} de daño al ${targetEnemigo.nombre}.`);
      }
      break;
    }

    case 'esquivar': {
      combat.esquivandoJugador = true;
      const r = calcularDaño(4, 10, 0.10, 1.4);
      dañoAlEnemigo = (targetEnemigo.esEtereo && !combat.yrdenActivo) ? 0 : r.daño;
      msgs.push(`🛡️ Esquivás y contraatacás por ${dañoAlEnemigo > 0 ? dañoAlEnemigo : 0}.`);
      break;
    }

    case 'quen': {
      if (combat.quenCooldown > 0) {
        showNotification(`🔵 Quen en recarga: ${combat.quenCooldown} turno/s`); return;
      }
      combat.quenActivo   = true;
      combat.quenCooldown = 3;
      document.getElementById('combat-quen-badge').classList.remove('hidden');
      msgs.push(`🔵 Señal Quen activada. El próximo golpe será absorbido.`);
      break;
    }

    case 'yrden': {
      if (combat.yrdenCooldown > 0) {
        showNotification(`🟣 Yrden en recarga: ${combat.yrdenCooldown} turno/s`); return;
      }
      combat.yrdenActivo   = true;
      combat.yrdenTurnos   = 3;
      combat.yrdenCooldown = 4;
      document.getElementById('combat-yrden-badge').classList.remove('hidden');
      msgs.push(`🟣 Trampa Yrden activa — espectros materializados por ${combat.yrdenTurnos} turnos.`);
      break;
    }

    case 'aard': {
      if (combat.aardCooldown > 0) {
        showNotification(`💨 Aard en recarga: ${combat.aardCooldown} turno/s`); return;
      }
      if (targetEnemigo.esEtereo && !combat.yrdenActivo) {
        msgs.push(`💨 Aard atraviesa al ${targetEnemigo.nombre} sin efecto. Necesitás Yrden primero.`);
        combat.aardCooldown = 2;
        break;
      }
      const r = calcularDaño(8, 16, 0.12, 1.5);
      dañoAlEnemigo = r.daño; huboCritico = r.esCritico;
      combat.aardCooldown      = 3;
      // Aard aturde solo al enemigo principal (no al ghoul secundario)
      if (combat.targetActual !== 2) {
        combat.stunEnemigoTurnos = 1;
        const stunEnemEl = document.getElementById('combat-stun-enemy');
        stunEnemEl.textContent = `😵 Aturdido (1)`;
        stunEnemEl.classList.remove('hidden');
      }
      msgs.push(huboCritico
        ? `💨⚡ ¡AARD CRÍTICO! ${dañoAlEnemigo} daño — ${targetEnemigo.nombre} aturdido 1 turno.`
        : `💨 Aard: ${dañoAlEnemigo} daño — ${targetEnemigo.nombre} aturdido 1 turno.`
      );
      if (huboCritico) mostrarCritico();
      break;
    }

    case 'igni': {
      if (combat.igniCooldown > 0) {
        showNotification(`🔥 Igni en recarga: ${combat.igniCooldown} turno/s`); return;
      }
      const r = calcularDaño(22, 42, 0.25, 2.0);
      dañoAlEnemigo = r.daño; huboCritico = r.esCritico;
      if (verificarEsquiva(targetEnemigo.velocidad * 0.5)) {
        dañoAlEnemigo = Math.floor(dañoAlEnemigo * 0.35);
        combat.igniCooldown = 3;
        msgs.push(`🔥 Igni — esquivado parcialmente. ${dañoAlEnemigo} daño. Sin quemadura.`);
      } else {
        combat.burnTurnos   = 3;
        combat.igniCooldown = 3;
        const burnEl = document.getElementById('combat-burn');
        burnEl.textContent = `🔥 Quemando (3)`; burnEl.classList.remove('hidden');
        msgs.push(huboCritico
          ? `🔥⚡ ¡IGNI CRÍTICO! ${dañoAlEnemigo} daño + quemadura (3 turnos).`
          : `🔥 Igni: ${dañoAlEnemigo} daño + quemadura (3 turnos).`
        );
        if (huboCritico) mostrarCritico();
      }
      break;
    }

    case 'usar_venda': {
      if (player.vendas <= 0) {
        showNotification('No tenés vendas 🩹');
        return;
      }
      const curado = Math.floor(Math.random() * 21) + 20; // 20–40 HP
      player.vendas--;
      player.vida = Math.min(player.vidaMax, player.vida + curado);
      msgs.push(`🩹 Usás una venda — recuperás ${curado} vida. (${player.vendas} vendas restantes)`);
      // El enemigo igual ataca este turno
      break;
    }
  }

  /* ── APLICAR DAÑO AL ENEMIGO ── */
  if (dañoAlEnemigo > 0) {
    dañoAlEnemigo = Math.max(1, dañoAlEnemigo - (targetEnemigo.defensa || 0));
    // Quen del enemigo solo aplica al principal
    if (combat.enemigoEsquivando && combat.targetActual !== 2) {
      dañoAlEnemigo = Math.max(1, Math.floor(dañoAlEnemigo * 0.18));
      combat.enemigoEsquivando = false;
      msgs.push(`[Quen del enemigo absorbió el golpe — solo ${dañoAlEnemigo} daño.]`);
    }
  }

  // Aplicar al target seleccionado
  if (combat.tieneDosEnemigos && combat.targetActual === 2) {
    combat.enemigoVida2 = Math.max(0, combat.enemigoVida2 - dañoAlEnemigo);
  } else {
    combat.enemigoVida = Math.max(0, combat.enemigoVida - dañoAlEnemigo);
  }

  // Decrementar Yrden
  if (combat.yrdenActivo) {
    combat.yrdenTurnos--;
    if (combat.yrdenTurnos <= 0) {
      combat.yrdenActivo = false;
      document.getElementById('combat-yrden-badge').classList.add('hidden');
      msgs.push(`🟣 La trampa Yrden se disipó.`);
    }
  }

  /* ── TRANSICIÓN DE FASE (boss) ── */
  if (combat.esBoss && combat.faseActual === 1) {
    const bossData = BOSSES[combat.bossKey];
    if (combat.enemigoVida / bossData.fase1.vidaMax <= bossData.umbralFase2) {
      setCombatMessage(msgs.join(' | '), false); updateCombatBars();
      iniciarTransicionFase2(); return;
    }
  }

  /* ── MUERTE DEL ENEMIGO ── */
  if (combat.tieneDosEnemigos) {
    // Combate dual — verificar cada enemigo por separado
    const brujaMuerta = combat.enemigoVida  <= 0;
    const ghoulMuerto = combat.enemigoVida2 <= 0;

    if (brujaMuerta || ghoulMuerto) {
      if (brujaMuerta && ghoulMuerto) {
        msgs.push(`¡La Bruja Sepulcral y el ghoul han caído!`);
        setCombatMessage(msgs.join(' | '), false); updateCombatBars();
        endCombat(true); return;
      } else if (brujaMuerta) {
        msgs.push(`¡La Bruja Sepulcral ha caído! El ghoul sigue en pie.`);
        combat.targetActual = 2;
        actualizarBotonesTarget();
      } else {
        msgs.push(`¡El ghoul ha caído! La bruja sigue en pie.`);
        combat.targetActual = 1;
        actualizarBotonesTarget();
      }
    }
  } else {
    if (combat.enemigoVida <= 0) {
      msgs.push(`¡${combat.enemigo.nombre} ha caído!`);
      setCombatMessage(msgs.join(' | '), false); updateCombatBars();
      endCombat(true); return;
    }
  }

  /* ── TURNO DEL ENEMIGO ── */
  const msgsE = turnoEnemigo();
  msgsE.forEach(m => msgs.push(m));

  _decrementarCooldowns();
  setCombatMessage(msgs.join(' | '), false);
  updateCombatBars(); updateStats();

  if (player.vida <= 0) {
    setCombatMessage(msgs.join(' | ') + ' | 💀 Tu vida cayó a cero...', false);
    setTimeout(() => endCombat(false), 1800);
  }
}

function _decrementarCooldowns() {
  if (combat.igniCooldown  > 0) { combat.igniCooldown--;  updateIgniButton(); }
  if (combat.quenCooldown  > 0) { combat.quenCooldown--;  _actualizarBtnSenal('btn-quen',  'Quen',  combat.quenCooldown);  }
  if (combat.yrdenCooldown > 0) { combat.yrdenCooldown--; _actualizarBtnSenal('btn-yrden', 'Yrden', combat.yrdenCooldown); }
  if (combat.aardCooldown  > 0) { combat.aardCooldown--;  _actualizarBtnSenal('btn-aard',  'Aard',  combat.aardCooldown);  }
}

function _actualizarBtnSenal(id, nombre, cd) {
  const btn = document.getElementById(id);
  if (!btn) return;
  btn.disabled = cd > 0;
  const labels = {
    'btn-quen':  { on: '🔵 Quen',  off: `🔵 Quen (${cd})`  },
    'btn-yrden': { on: '🟣 Yrden', off: `🟣 Yrden (${cd})` },
    'btn-aard':  { on: '💨 Aard',  off: `💨 Aard (${cd})`  },
  };
  const label = labels[id];
  btn.textContent = label ? (cd > 0 ? label.off : label.on) : (cd > 0 ? `${nombre} (${cd})` : nombre);
}

function _actualizarBadgeSangrado() {
  const el = document.getElementById('combat-sangrado');
  if (!el) return;
  if (combat.sangradoTurnos > 0) { el.textContent = `🩸 Sangrando (${combat.sangradoTurnos})`; el.classList.remove('hidden'); }
  else                             { el.classList.add('hidden'); }
}

function _actualizarBadgeStun() {
  const el = document.getElementById('combat-stun-self');
  if (!el) return;
  if (combat.stunTurnos > 0) { el.textContent = `😵 Aturdido (${combat.stunTurnos})`; el.classList.remove('hidden'); }
  else                         { el.classList.add('hidden'); }
}


/* ======================================================
   11. IA DE ENEMIGOS ESPECIALES
   ====================================================== */

function turnoEnemigo() {
  if (combat.stunEnemigoTurnos > 0) {
    combat.stunEnemigoTurnos--;
    const stunEl = document.getElementById('combat-stun-enemy');
    if (combat.stunEnemigoTurnos > 0) {
      stunEl.textContent = `😵 Aturdido (${combat.stunEnemigoTurnos})`;
      stunEl.classList.remove('hidden');
    } else {
      stunEl.classList.add('hidden');
    }
    return [`😵 ${combat.enemigo.nombre} está aturdido — pierde su turno.`];
  }

  if (combat.esquivandoJugador) {
    const rozón = Math.max(1, Math.floor(
      (Math.floor(Math.random() * (combat.enemigo.ataqueMax - combat.enemigo.ataqueMin + 1)) +
       combat.enemigo.ataqueMin) * 0.12
    ));
    player.vida = Math.max(0, player.vida - rozón);
    return [`Esquivaste el ataque — solo ${rozón} de rozón.`];
  }

  if (combat.esBoss && combat.faseActual === 2) {
    if (combat.bossKey === 'bruja_boss') return turnoEnemigoBrujaFase2();
    return turnoEnemigoBossFase2();
  }

  if (combat.enemigo.tipoEnemigo === 'lobo')    return turnoLobo();
  if (combat.enemigo.tipoEnemigo === 'espectro') return turnoEspectro();

  // Enemigo genérico
  const { daño, esCritico } = calcularDaño(
    combat.enemigo.ataqueMin, combat.enemigo.ataqueMax,
    combat.enemigo.critChance, combat.enemigo.critMult
  );
  player.vida = Math.max(0, player.vida - daño);
  if (esCritico) return [`💥 ¡CRÍTICO del ${combat.enemigo.nombre}! ${daño} de daño.`];
  const frases = [
    `${combat.enemigo.nombre} ataca — ${daño} de daño.`,
    `Golpe del ${combat.enemigo.nombre}: recibís ${daño}.`,
    `El ${combat.enemigo.nombre} arremete — ${daño} de daño.`,
  ];
  return [frases[Math.floor(Math.random() * frases.length)]];
}

function turnoLobo() {
  const msgs  = [];
  const accion = Math.random();

  if (accion < 0.45) {
    const daño = Math.floor(Math.random() * 9) + 6; // 6–14
    player.vida = Math.max(0, player.vida - daño);
    if (combat.sangradoTurnos === 0) {
      combat.sangradoTurnos = 3;
      _actualizarBadgeSangrado();
      msgs.push(`🐺 El lobo te muerde — ${daño} daño + ¡sangrado por 3 turnos!`);
    } else {
      msgs.push(`🐺 El lobo te muerde de nuevo — ${daño} daño. Sangrado continúa.`);
    }
  } else if (accion < 0.75 && !combat.esquivandoJugador) {
    if (combat.quenActivo) {
      combat.quenActivo = false;
      document.getElementById('combat-quen-badge').classList.add('hidden');
      msgs.push(`🐺 El lobo se abalanza — ¡Quen absorbe el impacto!`);
    } else {
      combat.stunTurnos = 1;
      _actualizarBadgeStun();
      const daño = Math.floor(Math.random() * 7) + 4; // 4–10
      player.vida = Math.max(0, player.vida - daño);
      msgs.push(`🐺 El lobo se abalanza — ${daño} daño. ¡Quedás aturdido un turno!`);
    }
  } else {
    const { daño, esCritico } = calcularDaño(
      combat.enemigo.ataqueMin, combat.enemigo.ataqueMax,
      combat.enemigo.critChance, combat.enemigo.critMult
    );
    player.vida = Math.max(0, player.vida - daño);
    msgs.push(esCritico
      ? `💥 ¡El lobo embiste con furia! CRÍTICO — ${daño} de daño.`
      : `🐺 El lobo arremete — ${daño} de daño.`
    );
  }
  return msgs;
}

function turnoEspectro() {
  const msgs = [];
  const { daño, esCritico } = calcularDaño(
    combat.enemigo.ataqueMin, combat.enemigo.ataqueMax,
    combat.enemigo.critChance, combat.enemigo.critMult
  );

  if (combat.quenActivo) {
    combat.quenActivo = false;
    document.getElementById('combat-quen-badge').classList.add('hidden');
    msgs.push(`👻 El espectro atraviesa tu Quen — el escudo no sirve contra etéreos.`);
  }

  player.vida = Math.max(0, player.vida - daño);
  msgs.push(esCritico
    ? `👻 ¡El espectro te atraviesa! CRÍTICO — ${daño} de daño frío.`
    : `👻 El espectro emerge desde las sombras — ${daño} de daño.`
  );
  return msgs;
}


/* ======================================================
   12. IA DEL JEFE FINAL FASE 2 — El Brujo Mutado
   ====================================================== */

function turnoEnemigoBossFase2() {
  const msgs  = [];
  const fase2 = BOSSES.jefe_final.fase2;

  let accion = elegirHabilidadBoss(fase2);
  const pct  = combat.enemigoVida / fase2.vidaMax;
  if (pct < fase2.umbralCuracionEmergencia && Math.random() < 0.65) {
    accion = 'curar';
  }

  switch (accion) {
    case 'atacar': {
      const { daño, esCritico } = calcularDaño(
        fase2.ataqueMin, fase2.ataqueMax, fase2.critChance, fase2.critMult
      );
      player.vida = Math.max(0, player.vida - daño);
      msgs.push(esCritico
        ? `💥 El Brujo Mutado lanza un golpe calculado: ¡CRÍTICO! ${daño} de daño.`
        : `🧙 El Brujo Mutado te embiste con una velocidad que reconocés. ${daño} de daño.`
      );
      break;
    }
    case 'señal': {
      const dañoMagico = Math.floor(Math.random() * 19) + 14; // 14–32
      player.vida = Math.max(0, player.vida - dañoMagico);
      msgs.push(`🔥 ¡El Brujo Mutado usa Igni mutado! Señales que reconocés del gremio. ${dañoMagico} daño mágico.`);
      break;
    }
    case 'curar': {
      const curado = Math.floor(fase2.vidaMax * 0.13);
      combat.enemigoVida = Math.min(fase2.vidaMax, combat.enemigoVida + curado);
      msgs.push(`✨ El Brujo Mutado bebe un elixir de sus reservas. Se cura ${curado} vida.`);
      break;
    }
    case 'esquivar_activo': {
      combat.enemigoEsquivando = true;
      msgs.push(`🛡️ El Brujo Mutado lanza Quen. Tu próximo golpe será absorbido.`);
      break;
    }
  }
  return msgs;
}


/* ======================================================
   13. IA DE LA BRUJA FASE 2 — Bruja + Ghoul
   ====================================================== */

function turnoEnemigoBrujaFase2() {
  const msgs  = [];
  const fase2 = BOSSES.bruja_boss.fase2;

  // La bruja ataca si sigue viva
  if (combat.enemigoVida > 0) {
    // En dual sólo usa atacar o hechizo (el ghoul_embiste lo reemplaza el ghoul mismo)
    const acciones      = ['atacar', 'hechizo_oscuro'];
    const probabilidades = [0.55, 0.45];
    const rand = Math.random();
    let acum = 0;
    let accion = acciones[0];
    for (let i = 0; i < acciones.length; i++) {
      acum += probabilidades[i];
      if (rand <= acum) { accion = acciones[i]; break; }
    }

    if (accion === 'atacar') {
      msgs.push(`🧙‍♀️ La bruja te golpea con energía oscura — 0 de daño. [TEST]`);
    } else {
      msgs.push(`💀 Hechizo oscuro de la bruja — 0 daño mágico. [TEST]`);
    }
  }

  // El ghoul ataca si sigue vivo (independiente de la bruja)
  if (combat.enemigoVida2 > 0) {
    msgs.push(`👹 El ghoul embiste — 0 de daño. [TEST]`);
  }

  return msgs;
}

function elegirHabilidadBoss(fase2) {
  const habilidades    = fase2.habilidades;
  const probabilidades = fase2.probabilidades;
  const rand = Math.random();
  let acum   = 0;
  for (let i = 0; i < habilidades.length; i++) {
    acum += probabilidades[i];
    if (rand <= acum) return habilidades[i];
  }
  return habilidades[0];
}


/* ======================================================
   14. TRANSICIÓN DE FASE DEL BOSS
   ====================================================== */

function iniciarTransicionFase2() {
  combat.enTransicion = true;
  setState('transicion');
  setBotonsCombate(false);

  if (combat.bossKey === 'bruja_boss') {
    // Bruja: muestra diálogo antes de activar fase 2
    setCombatMessage('La Bruja Sepulcral emite un sonido extraño...', true);
    const dialogoFase2Bruja = [
      {
        hablante: 'Bruja Sepulcral',
        retrato:  'assets/portraits/enemies/bruja-sepulcral.png',
        texto:    '*Un sonido gutural e inhumano resuena en el pantano. Grave, vibrante, como si viniera de adentro de la tierra misma.*',
      },
      {
        hablante: 'Brujo del Gato',
        retrato:  'assets/portraits/npc/protagonista.png',
        texto:    'Antes de que puedas lanzarte de nuevo al combate, algo emerge desde las sombras del pantano.',
      },
      {
        hablante: 'Bruja Sepulcral',
        retrato:  'assets/portraits/enemies/bruja-sepulcral.png',
        texto:    '*Un ghoul se arrastra hacia vos. La bruja sonríe.*',
      },
    ];
    startDialogue(dialogoFase2Bruja, () => {
      _activarFase2();
    });
  } else {
    // Jefe final: mensaje dramático + timeout
    setCombatMessage(
      '⚡ LA FIGURA SE DETIENE. Con un movimiento lento, se baja la capucha. ' +
      'Frente a vos hay un brujo — o lo que queda de uno. ' +
      '"Sos muy joven para morir acá. Yo tenía tu edad cuando dejé el gremio." ' +
      '"Pero ya es demasiado tarde para parar." ...El combate no terminó.',
      true
    );
    document.getElementById('combat-panel').classList.add('fase-transition');
    setTimeout(() => _activarFase2(), 3200);
  }
}

/**
 * Activa los stats y visual de la fase 2 del boss actual.
 * Llamado desde iniciarTransicionFase2 (directo o tras diálogo).
 */
function _activarFase2() {
  const fase2 = BOSSES[combat.bossKey].fase2;

  if (fase2.stunTransicion) {
    combat.stunTurnos = 1;
    _actualizarBadgeStun();
  }

  const enemyVisualEl2 = document.getElementById('enemy-visual');
  if (fase2.retrato) {
    enemyVisualEl2.innerHTML = '';
    const imgFase2 = document.createElement('img');
    imgFase2.alt   = fase2.nombre;
    imgFase2.style.cssText = 'width:240px;height:300px;object-fit:contain;object-position:center;';
    enemyVisualEl2.appendChild(imgFase2);
    _setPortrait(imgFase2, fase2.retrato);
  } else {
    enemyVisualEl2.textContent = fase2.visual;
  }

  document.getElementById('enemy-name').textContent = fase2.nombre;
  document.getElementById('combat-panel').classList.add('boss-fase2');
  document.getElementById('combat-panel').classList.remove('fase-transition');

  const faseEl = document.getElementById('combat-fase');
  faseEl.textContent = '⚡ FASE 2';
  faseEl.classList.remove('hidden');

  combat.faseActual = 2;
  combat.enemigo    = fase2;

  if (combat.bossKey === 'bruja_boss') {
    // La bruja conserva la vida que tenía al llegar al umbral (~40%)
    // Invoca al ghoul como segundo enemigo con HP independiente
    combat.enemigo2         = { ...ENEMIES.ghoul, nombre: 'Ghoul Invocado' };
    combat.enemigoVida2     = ENEMIES.ghoul.vidaMax;
    combat.tieneDosEnemigos = true;
    combat.targetActual     = 1;
    mostrarSegundoEnemigo();
  } else {
    // Jefe final: la vida se resetea a la de fase 2
    combat.enemigoVida = fase2.vidaMax;
  }

  combat.burnTurnos  = 0;
  document.getElementById('combat-burn').classList.add('hidden');

  setCombatMessage(
    `⚡ FASE 2 — ${fase2.nombre}. ${fase2.descripcion}` +
    (fase2.stunTransicion ? ' ¡Quedás aturdido un turno!' : ' Prepárate.'),
    true
  );

  updateCombatBars();
  combat.enTransicion = false;
  setState('combate');
  setBotonsCombate(true);
}


/* ── HELPERS DE COMBATE DUAL ─────────────────────────── */

function mostrarSegundoEnemigo() {
  const sec = document.getElementById('enemy2-info');
  const tgt = document.getElementById('target-select');
  if (sec) {
    sec.classList.remove('hidden');
    document.getElementById('enemy2-name').textContent = combat.enemigo2.nombre;
  }
  if (tgt) tgt.classList.remove('hidden');
  actualizarBotonesTarget();
}

function ocultarSegundoEnemigo() {
  const sec = document.getElementById('enemy2-info');
  const tgt = document.getElementById('target-select');
  if (sec) sec.classList.add('hidden');
  if (tgt) tgt.classList.add('hidden');
}

function seleccionarTarget(n) {
  if (!combat.tieneDosEnemigos) return;
  if (n === 1 && combat.enemigoVida  <= 0) return; // bruja ya muerta
  if (n === 2 && combat.enemigoVida2 <= 0) return; // ghoul ya muerto
  combat.targetActual = n;
  actualizarBotonesTarget();
}

function actualizarBotonesTarget() {
  const btn1 = document.getElementById('btn-target-1');
  const btn2 = document.getElementById('btn-target-2');
  if (!btn1 || !btn2) return;

  btn1.classList.toggle('btn-target-activo', combat.targetActual === 1);
  btn2.classList.toggle('btn-target-activo', combat.targetActual === 2);

  // Marcar muertos
  btn1.disabled = (combat.enemigoVida  <= 0);
  btn2.disabled = (combat.enemigoVida2 <= 0);
  if (combat.enemigoVida  <= 0) btn1.textContent = '🧙‍♀️ Bruja (muerta)';
  if (combat.enemigoVida2 <= 0) btn2.textContent = '👹 Ghoul (muerto)';
}


/* ======================================================
   15. FIN DE COMBATE
   ====================================================== */

function endCombat(victoria) {
  combat.activo           = false;
  combat.tieneDosEnemigos = false;
  ocultarSegundoEnemigo();
  setState('transicion');

  if (victoria) {
    let recompensa = { oro: 0, exp: 0 };

    if (combat.esBoss && combat.faseActual === 2) {
      const fase2 = BOSSES[combat.bossKey].fase2;
      recompensa  = { oro: fase2.recompensaOro || 0, exp: fase2.recompensaExp || 0 };
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
   16. UI DE COMBATE
   ====================================================== */

function updateCombatBars() {
  // Barra del enemigo principal
  const vidaMaxEnemigo = (combat.esBoss && combat.faseActual === 2)
    ? BOSSES[combat.bossKey].fase2.vidaMax
    : combat.enemigo.vidaMax;

  const enemPct = Math.max(0, (combat.enemigoVida / vidaMaxEnemigo) * 100);
  const enemBar = document.getElementById('enemy-vida-bar');
  enemBar.style.width = `${enemPct}%`;
  enemBar.style.background =
    enemPct > 60 ? '#f87171' :
    enemPct > 30 ? '#fb923c' : '#facc15';
  document.getElementById('enemy-vida-text').textContent =
    `${combat.enemigoVida} / ${vidaMaxEnemigo}`;

  // Barra del segundo enemigo (ghoul en bruja fase 2)
  if (combat.tieneDosEnemigos && combat.enemigo2) {
    const ghoulMax = combat.enemigo2.vidaMax;
    const ghoulPct = Math.max(0, (combat.enemigoVida2 / ghoulMax) * 100);
    const ghoulBar = document.getElementById('enemy2-vida-bar');
    if (ghoulBar) {
      ghoulBar.style.width = `${ghoulPct}%`;
      ghoulBar.style.background =
        ghoulPct > 60 ? '#f87171' :
        ghoulPct > 30 ? '#fb923c' : '#facc15';
    }
    const ghoulText = document.getElementById('enemy2-vida-text');
    if (ghoulText) ghoulText.textContent = `${combat.enemigoVida2} / ${ghoulMax}`;
  }

  // Barra del jugador
  const jugPct = Math.max(0, (player.vida / player.vidaMax) * 100);
  const jugBar = document.getElementById('player-combat-vida-bar');
  jugBar.style.width = `${jugPct}%`;
  jugBar.style.background =
    jugPct > 60 ? '#4ade80' :
    jugPct > 30 ? '#facc15' : '#f87171';
  document.getElementById('player-combat-vida-text').textContent =
    `${player.vida} / ${player.vidaMax}`;
}

function setCombatMessage(msg, revelacion = false) {
  const el = document.getElementById('combat-message');
  el.textContent = msg;
  el.classList.toggle('revelacion', revelacion);
}

function mostrarCritico() {
  const el = document.getElementById('combat-crit-flash');
  el.classList.remove('hidden', 'crit-flash');
  void el.offsetWidth;
  el.classList.add('crit-flash');
  setTimeout(() => el.classList.add('hidden'), 600);
}

function setBotonsCombate(habilitado) {
  document.querySelectorAll('.btn-combat').forEach(btn => {
    btn.disabled = !habilitado;
  });
  if (habilitado) {
    _actualizarBtnSenal('btn-quen',  'Quen',  combat.quenCooldown);
    _actualizarBtnSenal('btn-yrden', 'Yrden', combat.yrdenCooldown);
    _actualizarBtnSenal('btn-aard',  'Aard',  combat.aardCooldown);
    updateIgniButton();
  }
}

function resetIgniButton() {
  const btn = document.getElementById('btn-igni');
  btn.textContent = '🔥 Igni';
  btn.disabled    = false;
}

function updateIgniButton() {
  const btn = document.getElementById('btn-igni');
  if (combat.igniCooldown > 0) {
    btn.textContent = `🔥 Igni (${combat.igniCooldown})`;
    btn.disabled    = true;
  } else {
    btn.textContent = '🔥 Igni';
    btn.disabled    = false;
  }
}


/* ======================================================
   17. STATS Y NOTIFICACIONES
   ====================================================== */

function updateStats() {
  const pct = (player.vida / player.vidaMax) * 100;

  document.getElementById('vida-value').textContent = `${player.vida}/${player.vidaMax}`;

  const vidaBar = document.getElementById('vida-bar');
  vidaBar.style.width = `${Math.max(0, pct)}%`;
  vidaBar.style.background =
    pct > 60 ? '#4ade80' :
    pct > 30 ? '#facc15' : '#f87171';

  document.getElementById('oro-value').textContent    = player.oro;
  document.getElementById('exp-value').textContent    = player.experiencia;
  document.getElementById('nivel-value').textContent  = player.nivel;
  document.getElementById('vendas-value').textContent = player.vendas;
}

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
   18. REINICIO E INICIALIZACIÓN
   ====================================================== */

function reiniciarJuego() {
  player.vida        = 100;
  player.vidaMax     = 100;
  player.oro         = 5;
  player.experiencia = 0;
  player.nivel       = 1;
  player.vendas      = 2;

  combat.activo            = false;
  combat.esBoss            = false;
  combat.bossKey           = '';
  combat.faseActual        = 1;
  combat.igniCooldown      = 0;
  combat.quenCooldown      = 0;
  combat.yrdenCooldown     = 0;
  combat.aardCooldown      = 0;
  combat.burnTurnos        = 0;
  combat.sangradoTurnos    = 0;
  combat.stunTurnos        = 0;
  combat.quenActivo        = false;
  combat.yrdenActivo       = false;
  combat.yrdenTurnos       = 0;
  combat.enTransicion      = false;
  combat.enemigoEsquivando = false;
  combat.stunEnemigoTurnos = 0;
  combat.tieneDosEnemigos  = false;
  combat.targetActual      = 1;
  combat.enemigo2          = null;
  combat.enemigoVida2      = 0;

  ocultarSegundoEnemigo();

  Object.keys(flags).forEach(k => delete flags[k]);

  setState('narrativa');

  document.getElementById('combat-fase').classList.add('hidden');
  document.getElementById('combat-burn').classList.add('hidden');

  updateStats();
  loadScene('llegada_pueblo');
}

/* ── Preload de fondos ── */
function preloadBackgrounds() {
  const imagenes = [
    'assets/backgrounds/taberna.jpg',
    'assets/backgrounds/aldea.jpg',
    'assets/backgrounds/cementerio.jpg',
    'assets/backgrounds/bosque-noche.jpg',
    'assets/backgrounds/campamento.jpg',
    'assets/backgrounds/amanecer.jpg',
    'assets/backgrounds/cueva.jpg',
    'assets/backgrounds/laboratorio.jpg',
    'assets/backgrounds/muerte.jpg',
  ];
  imagenes.forEach((src) => {
    const img = new Image();
    img.src = src;
    img.onerror = () => console.warn(`[preload] No se encontró: ${src}`);
  });
}

document.addEventListener('DOMContentLoaded', () => {
  preloadBackgrounds();
  updateStats();
  loadScene('llegada_pueblo');
});
