# SESION.md — El Brujo del Gato RPG v3.0
> Leer este archivo cuando se pierda el contexto. Contiene todo el estado actual del proyecto.

---

## Historia completa (versión definitiva)

### Prólogo — El protagonista
Brujo de la **Escuela del Gato**. Joven, novato, **primer contrato**. Inexperto, tiende a involucrarse de más con los humanos. Sale con casi nada: 5 orens.

---

### Acto 1 — El Contrato

**Llegada al pueblo**: Tablón de anuncios vacío. Entra a la taberna a gastar sus últimos orens. Al quitarse la capucha siente el desprecio de la gente. Murmullos: "otro bicho raro", "un mutante". Habla con el tabernero: otro brujo pasó esta semana, tomó el contrato del alcalde, se fue a las montañas hace 5 días y no volvió. Dejó su caballo en el establo.

**Calle del pueblo**: Sale de la taberna. El pueblo está casi vacío — ninguna casa con luz, ningún animal. A 30 metros, una mujer joven tirada: **Marta**, herida en el estómago.

**Decisión 1 — Marta:**
- **Hablar con ella**: cuenta de una bruja en el cementerio saqueando tumbas. Tiene herida reciente.
  - **Curar con venda** (gasta 1 venda) → Marta sobrevive, da info valiosa al volver.
  - **No curar / sin vendas** → Marta muere mientras el brujo está en el cementerio.
- **Ignorarla** → Marta muere, se pierde el lore de la historia de la figura misteriosa.

**Cementerio** (TUTORIAL de combate): 20-30 tumbas recientes, mitad profanadas. Medallón vibra → combate con **Ghoul** (tutorial que explica todas las mecánicas). El ghoul tiene cadenas → fue controlado por la bruja.

**Bruja** (JEFE 1, 2 fases):
- Fase 1: bruja sola, 75 HP
- Al 40% HP: gruñido → stun al jugador 1 turno + invoca ghoul → Fase 2 (bruja + ghoul, 55 HP)

**Regreso de Marta** (si está viva):
- No tiene recompensa. Pide perdón. Perdió a su esposo y su hijo (soldado y aprendiz de 16 años).
- Cuenta la historia de la **figura encapuchada**: llegó al pueblo hace 3 meses buscando al **maese Kotlink**, alquimista. Solo se veía su ojo izquierdo amarillo brillante. Preguntó a todos por Kotlink. El alcalde reunió 15 soldados + 7-10 hombres con antorchas. El capitán atacó a la figura sin aviso. La figura frenó la espada con su mano derecha **monstruosa** y la rompió. Los llamaron monstruo. Entró en cólera y masacró a todos con velocidad extrema. El alcalde sobrevivió mirando desde la ventana.

**Alcalde** (diálogo con opciones): El otro brujo pagado por adelantado — no volvió, dejó su caballo. Fue con el cazador **Dorian** a las montañas. Dorian tampoco volvió. Dirección: norte, cruzando el bosque.

---

### Acto 2 — El Camino

**Bosque de noche**: Silencio total, sin pájaros. Ciervo muerto con heridas de hoja (no garras). Dos tipos de huellas: humanas y de lobo. El lobo seguía a la persona.

**Decisión 2 — Las huellas:**
- **Seguir huellas humanas**: encuentra a **Dorian** (cazador) inconsciente, mal herido por lobos. Mató 2, el tercero lo persiguió.
  - **Curar con venda** (gasta 1 venda, flag `cazador_curado`) → Dorian vive, al amanecer da la ubicación exacta de la cueva.
  - **No curar / sin vendas / abandonar** → Dorian muere, el brujo llega a la cueva sin info exacta (tarda más).
- **Seguir huellas del lobo**: pierde el rastro, Dorian muere desangrado. Sin info de la cueva.

**Lobo Maldito** (combate): el tercer lobo que perseguía a Dorian aparece. IA especial: mordida (sangrado 3 turnos) + abalanzarse (stun 1 turno).

**Campamento**: fogata, descanso → vida al 100%. A medianoche el fuego se apaga solo.

**Espectro** (combate, MECÁNICA YRDEN): intangible sin Yrden activo. OBLIGATORIO activar Yrden en el primer turno o ningún ataque funciona. Yrden dura 3 turnos.

**Amanecer**: espectro se disuelve con la luz. Vida recuperada al 100%.
- Si Dorian vive: da la dirección exacta de la cueva (+exp).
- Si Dorian muerto: el brujo va solo, tarda más pero el medallón lo guía.

---

### Acto 3 — La Cueva

**Exterior de la cueva**: marcas de garras en todos los árboles del perímetro. El medallón vibra fuerte. Bebe poción **Gato Negro** para ver en la oscuridad.

**Interior**: laboratorio improvisado. Cientos de viales, fórmulas en las paredes.

**Cadáver del brujo del Oso**: armadura gruesa, medallón del oso. Marcas de garras enormes Y tajos de espada limpios. Algo que sabe pelear.

**La Figura Misteriosa** (JEFE FINAL, 2 fases):
- El brujo intenta hablar → la figura dice "no confío en nadie, nunca más" → ataca.
- **Fase 1**: La Figura Misteriosa (encapuchada), 80 HP, muy veloz.
- Al 50% HP: **transición** — se baja la capucha. Revela que fue un brujo, que es joven para morir acá, que no quería esto. El combate no terminó.
- **Fase 2**: El Brujo Mutado (sin capucha), 70 HP. Usa señales del Gato (Igni, Quen). Se cura.

**Confrontación final** (post-combate): Arrodillado, lúcido. Cuenta su historia completa:
- Era brujo de la Escuela del Gato. Hace 100 años dejó el gremio.
- Hace 20 años: contrato de un hechicero (sangre de kikimora, algo fácil). Al entregar el cadáver el hechicero lo neutralizó con magia. Lo tuvo encadenado años experimentando mutágenos en él.
- Su brazo mutó lo suficiente para escapar. Desde entonces busca al hechicero (para matarlo) y al maese Kotlink (posible cura).
- En el pueblo solo quería preguntarle a Kotlink. Los humanos lo atacaron primero.

**Decisión final:**
- **Matarlo** → Final A: lleva la prueba, cobra el contrato, se lleva el caballo del brujo del Oso.
- **Dejarlo vivir** → Final B: le ofrece ayudarlo a encontrar a Kotlink. "Quizás los caminos se crucen." Vuelve al pueblo, el alcalde paga sin preguntar, se lleva igual el caballo.

---

## Estado del juego (v3.0)

### Archivos
| Archivo | Estado | Descripción |
|---|---|---|
| `game.js` | 🔄 En reescritura | Motor completo v3.0 con nueva historia |
| `style.css` | 🔄 Actualizar | Nuevas clases de fondos |
| `index.html` | 🔄 Actualizar | Stat de vendas + botón venda en combate |
| `dialogue.js` | ✅ Sin cambios | Sistema de diálogos con typewriter |
| `effects.js` | ✅ Sin cambios | Niebla CSS + partículas Canvas |

### Fondos necesarios (9)
| Clase CSS | Archivo | Escena |
|---|---|---|
| `fondo-taberna` | `taberna.jpg` | Interior taberna |
| `fondo-aldea` | `aldea.jpg` | Calles del pueblo |
| `fondo-cementerio` | `cementerio.jpg` | Cementerio de noche |
| `fondo-bosque-noche` | `bosque-noche.jpg` | Bosque denso nocturno |
| `fondo-campamento` | `campamento.jpg` | Fogata en el bosque |
| `fondo-amanecer` | `amanecer.jpg` | Amanecer post-espectro |
| `fondo-cueva` | `cueva.jpg` | Exterior cueva en montaña |
| `fondo-laboratorio` | `laboratorio.jpg` | Interior cueva / lab |
| `fondo-muerte` | `muerte.jpg` | Pantalla de muerte |

### Retratos NPC (7)
| Archivo | Personaje |
|---|---|
| `protagonista.png` | Brujo del Gato joven — ojo rasgado amarillo, armadura ligera negra |
| `tabernero.png` | Hombre mayor, recelo, paño en el hombro |
| `aldeana.png` | Marta — joven, asustada, herida en estómago |
| `alcalde.png` | Hombre mediana edad, cobarde, ropa buena pero arrugada |
| `cazador.png` | Dorian — hombre rudo, heridas de garra, inconsciente/agradecido |
| `jefe_encapuchado.png` | Solo un ojo izquierdo amarillo visible — oscuridad, figura grande |
| `jefe_mutado.png` | Rostro mitad humano mitad monstruoso, mutaciones visibles |

### Retratos enemigos (5)
| Archivo | Enemigo |
|---|---|
| `ghoul.png` | Criatura encorvada gris, cadenas en muñecas |
| `bruja.png` | Mujer ojos verdes brillantes, oscura |
| `lobo.png` | Lobo negro, ojos brillantes con luz propia |
| `espectro.png` | Figura semitransparente azulada |
| `jefe_fase1.png` | Figura encapuchada, ojo amarillo (misma que jefe_encapuchado NPC) |
| `jefe_fase2.png` | Brujo mutado sin capucha (misma que jefe_mutado NPC) |

### Mecánicas nuevas v3.0
- **Vendas**: jugador empieza con 2. Se usan en combate (heal 20-40 HP) o en diálogos (curar Marta / curar Dorian). Gasta 1 por uso. Se muestran en la barra de stats.
- **Bruja como jefe** (2 fases): stun al jugador en la transición de fase.
- **Texto dinámico en escenas**: `texto` puede ser función `() => string` para usar flags en tiempo de carga.
- **Yrden obligatorio** vs espectros: mismo sistema que antes pero reforzado en el texto.

### Flags del juego v3.0
| Flag | Activado cuando |
|---|---|
| `hablo_aldeana` | Habló con Marta |
| `aldeana_curada` | Usó venda en Marta |
| `ignoro_aldeana` | La ignoró completamente |
| `escucho_historia` | Escuchó la historia de la figura misteriosa |
| `sabe_historia_figura` | Conoce la historia de la figura (por Marta) |
| `hablo_alcalde` | Habló con el alcalde |
| `cazador_curado` | Usó venda en Dorian |
| `cazador_muerto_por_lobo` | Siguió huellas del lobo, Dorian murió |
| `abandono_cazador` | Encontró a Dorian pero lo dejó |
| `siguio_huellas_humano` | Siguió las huellas humanas |
| `siguio_huellas_lobo` | Siguió las huellas del lobo |
| `derroto_lobo` | Ganó el combate del lobo |
| `derroto_espectro` | Venció al espectro |
| `intento_dialogar_jefe` | Intentó hablar antes de pelear |
| `investigo_cadaver` | Investigó el cadáver del brujo del Oso |
| `perdono_jefe` | Eligió dejar vivir al brujo mutado |

---

## Próximos pasos
1. ✅ Analizar historia completa
2. 🔄 Reescribir game.js, style.css, index.html
3. ⏳ Crear imágenes (9 fondos + 11 retratos) con IA
4. ⏳ Testear juego completo
5. ⏳ Ajustes post-testing

---

## Cómo usar este archivo
Cuando se agote el contexto, Lucas escribe: **"lee SESION.md"**
Claude lee este archivo y retoma sin preguntar nada.
