# Fisher man and Fisher girl

Juego de competencia para dos personas. Cada una usa su teléfono como control y mira su mitad de la pantalla del computador. Hay que **pescar, cortar, cocinar, servir y decorar** un pescado: gana quien termina primero. El juego solo acaba cuando las dos personas completan los cinco pasos.

- **Autoría:** [Anto Acevedo- Maite Villarroel] — [DPPI / udp / Encargo 07]
- **Base técnica:** librería *Tacto* (`tacto.js`) entregada en el curso; se conecta por MQTT a un broker EMQX Cloud propio del grupo.
- **Cómo probarlo:** abrir `juego.html` en el computador y escanear el QR con el teléfono (ver "Funcionamiento").

---

## 1. Concepto

### Relación entre tocar, ver y oír

La idea es que **el teléfono deje de ser una pantalla y pase a ser una herramienta en la mano**: una caña, un carrete, un cuchillo, una sartén, una mano que arrastra. El teléfono casi no muestra nada importante. Lo que pasa se *ve* en el computador y se *oye* en los parlantes. El gesto es la causa, y la imagen y el sonido son la consecuencia.

- **Tocar:** el gesto físico. Lanzar con la muñeca, girar el dedo, trazar líneas, subir el teléfono de golpe, arrastrar.
- **Ver:** todo se ve en **primera persona**. La cámara acompaña la acción: sube cuando lanzas la caña, se sacude cuando el pez tira, baja la vista hacia la tabla para cortar, se inclina sobre la sartén y mira el plato desde arriba.
- **Oír:** cada acción tiene su sonido (lanzar, chapoteo, picada, corte, voltear, servir, salsa). El sonido confirma que el gesto "entró" y marca el ritmo.
- **Sentir (vibración):** el teléfono vibra cuando el pez pica, cuando tira fuerte, cuando cortas, cuando hay que voltear y al ganar o perder. Cierra el circuito: el cuerpo recibe de vuelta algo de lo que hizo.

### Qué queremos que la persona sienta o descubra

Queremos que la persona descubra que **un gesto cotidiano sin pantalla** (mover la muñeca, trazar una línea, voltear algo en el aire) **puede controlar un mundo visual**, y que lo entienda sin instrucciones largas. Queremos que sienta **tensión y pequeñas victorias**: esperar que pique, sentir el tirón, no soltar el carrete, acertar el momento de voltear. Y que haya algo de **competencia y humor**: el rival ya terminó, el GANASTE verde y el PERDISTE rojo.

---

## 2. Funcionamiento

### Los cinco pasos

| Paso | Qué se ve (primera persona) | Qué hace la persona en el teléfono |
|---|---|---|
| 1. Pesca | Caña, agua y horizonte. La cámara sube al lanzar, baja al caer el anzuelo y vibra cuando el pez tira. | Lanzar con un golpe de muñeca, esperar la picada y luego girar el dedo en círculos para enrollar. |
| 2. Cortar | Pescado horizontal sobre una tabla de madera horizontal, con un cuchillo. | Trazar 5 líneas con el dedo, en cualquier lugar. El teléfono muestra puntos con la forma del pescado. |
| 3. Cocinar | Sartén negra. El fuego aparece solo cuando se mueve la sartén. | Mover el teléfono para avivar el fuego y subirlo de golpe cuando el juego avisa "¡VOLTEA!" (5 veces, entre 5 y 10 s). |
| 4. Servir | Plato blanco vacío y el pescado arriba. | Arrastrar el pescado hasta el plato siguiendo los puntos del teléfono. |
| 5. Decorar | Aparecen 5 extras: tomate, lechuga, papas, salsa en un jarro y perejil. | Arrastrar cada extra al plato. Tomate, lechuga y papas quedan debajo del pescado; salsa y perejil, encima. Al pasar el jarro sobre el pescado cae la salsa. |
| Final | El plato servido en alto. | Nada: se ve **GANASTE** en verde (quien termina primero) o **PERDISTE** en rojo. |

### Tabla de conexiones: gesto → variable → efecto

| Gesto (teléfono) | Sensor / dato | Variable en el juego | Efecto visual | Efecto sonoro / háptico |
|---|---|---|---|---|
| Golpe de muñeca hacia adelante | Giro (`rotationRate`) o aceleración (`accelerationIncludingGravity`) | Fuerza del lanzamiento (`swing`, 0 a 2) | Sube la cámara, vuela el anzuelo; más fuerza, más lejos | Silbido del lanzamiento (`cast`) y chapoteo al caer |
| Quedarse quieto | Sin movimiento | Espera de la picada (entre 3 y 6 s al azar) | Boya flotando, cámara tranquila | — |
| (el juego decide) Picada | — | Ventana de reacción de ~3 s | Boya se hunde, salpicadura, cámara sacude | Sonido de picada + vibración larga |
| Girar el dedo en círculos | Ángulo del dedo alrededor del centro del pad táctil | Velocidad de enrollado (vueltas por segundo) | Barra de progreso, el pez se acerca; si frenas, el pez tira y la cámara se inclina | Vibración corta cuando frenas; tirones fuertes con vibración |
| Trazar una línea con el dedo | Posición táctil (x, y) y largo del trazo | Contador de cortes (0 a 5) | El cuchillo baja y el pescado se separa; al 5.º corte quedan 6 partes | Sonido de corte (`chop`) + vibración corta |
| Mover el teléfono | Intensidad del movimiento (promedio decayendo en el tiempo) | Altura de las llamas bajo la sartén | El fuego solo se ve mientras hay movimiento; la sartén se balancea | — |
| Subir el teléfono de golpe | Mismo `swing` ≥ 1 durante el aviso | Volteo del pescado (1 a 5) | El pescado salta y cae del otro lado; cambian las marcas de cocción | Sonido de volteo + vibración |
| Arrastrar con el dedo | Posición táctil normalizada | Posición del objeto arrastrado | El objeto sigue al dedo; al soltarlo sobre el plato se acomoda solo en una posición fija | Sonido de tomar/soltar (`pick`, `place`) + vibración |
| Mover el jarro sobre el pescado | Posición táctil | Salsa activada | El jarro desaparece y la salsa cae en líneas | Sonido de verter (`pour`) |
| Completar los 5 pasos | — | Orden de llegada | Plato en alto, GANASTE / PERDISTE | Fanfarria o tono grave + vibración |

### Cómo se conecta el teléfono (MQTT)

1. El computador abre `juego.html`. Genera un **código de sala** aleatorio y muestra un **QR** que apunta a `control.html?sala=XXXX`.
2. El teléfono escanea el QR, escribe su nombre y toca "Conectar". Acepta el permiso de movimiento (en iPhone es obligatorio).
3. Ambos se conectan por **MQTT sobre WebSockets seguros (wss)** a un broker **EMQX Cloud** propio. La página usa la librería `mqtt.js` y la capa `tacto.js`.
4. Los mensajes viajan por tópicos que incluyen la sala y el dispositivo:

| Tópico | Dirección | Contenido (JSON) |
|---|---|---|
| `tacto/<sala>/<dispositivo>/status` | teléfono → computador | Nombre, si está en línea y sus capacidades (retenido; si se cae el teléfono, el broker publica `online:false`) |
| `tacto/<sala>/<dispositivo>/motion` | teléfono → computador | `r` giro en °/s y `c` aceleración con gravedad, unas 30 veces por segundo |
| `tacto/<sala>/<dispositivo>/touch` | teléfono → computador | `n` (dedos), `ar` (proporción del pad) y `p` con posición `x,y` normalizada |
| `tacto/<sala>/<dispositivo>/cmd` | computador → teléfono | Estado del juego (`estado`, cortes, volteos, objetos del plato, resultado) y orden de vibrar (`vibe`) |

5. El primer teléfono que se conecta es el Jugador 1 y el segundo el Jugador 2. Si uno se cae, el siguiente que entra toma su lugar.
6. **Todo el juego corre en el computador.** El teléfono solo envía sensores y toques, y dibuja lo que el juego le dice (puntos, plato, aviso de voltear). Así los dos jugadores ven siempre lo mismo.
7. Para probar sin teléfono hay un **modo teclado** (J1: `Q` y `W`; J2: `P` y `O`), y las teclas `1` a `4` saltan entre escenas.

### Sonidos y autoría

**No se usaron archivos de audio ni sonidos de terceros.** Todos los sonidos se **sintetizan en tiempo real con la Web Audio API** del navegador (osciladores y ruido filtrado), en el código de `juego.js`. Se diseñaron en conjunto con el asistente de IA Claude,  las ideas de qué sonido corresponde a cada acción y los ajustes son propios.

| Sonido | Cómo se genera | Cuándo suena |
|---|---|---|
| Lanzamiento | Ruido filtrado agudo, corto | Al lanzar la caña |
| Chapoteo | Ruido filtrado grave, más largo | Al caer el anzuelo y al picar |
| Picada | Dos tonos triangulares (880 y 1175 Hz) | Cuando pica el pez y cuando hay que voltear |
| Corte | Ruido corto más un tono cuadrado grave que baja | Cada corte |
| Volteo | Ruido filtrado | Al voltear el pescado |
| Tomar y soltar | Tono corto / tono que baja más ruido suave | Al arrastrar y al dejar en el plato |
| Verter salsa | Ruido filtrado largo | Al pasar el jarro sobre el pescado |
| Victoria | Cuatro notas ascendentes (do, mi, sol, do) | Al atrapar un pez y al ganar |
| Pérdida | Tono grave que cae | Cuando se escapa el pez |

Los gráficos están dibujados en código (canvas 2D); no se usaron imágenes externas. La librería `tacto.js` y `mqtt.js` (carpeta `vendor/`) no son de mi autoría.

---

## 3. Reflexión

Lo que más nos sorprendió al hacer este proyecto fue darnos cuenta de cuánto significa un gesto cuando ocurre algo al otro lado. Antes de armarlo, mover el teléfono, trazar una línea con el dedo o subirlo de golpe como si fuera una sartén eran movimientos sin importancia, pero cuando la cámara sube con la caña, el pez tira y el teléfono vibra, esos mismos movimientos empezaron a sentirse como acciones propias. Entendimos que lo que hace que algo se sienta real no es lo realista que se vea, sino que lo que hacemos con el cuerpo tenga una respuesta inmediata en lo que vemos, oímos y hacemos. También nos dimos cuenta de que quisimos que cada paso se sintiera distinto: esperar con paciencia al pescar, ser preciso al cortar, estar atento al cocinar y cuidadoso al servir, y que cambiar el gesto cambiara también el ánimo de quien juega.

Aun así, sentimos que hay cosas importantes que se quedaron fuera. Un teléfono no pesa ni tira de vuelta, así que la fuerza de un pez de verdad, el calor de una sartén o la textura de una tabla de cortar son cosas que solo pudimos sugerir. 

Si siguiéramos trabajando en el juego, lo primero sería hacer que cada persona deje algo propio en su plato y se vuelva algo distintivo y propio, de modo que el orden y la forma en que sirve los ingredientes cambien cómo se ve el resultado final y todos los platos sean únicos. Lo segundo sería que el sonido responda al cuerpo, con cortes más fuertes cuando el gesto es más rápido y una sartén que crepite más cuando el fuego está más vivo.


## Cómo ejecutarlo

- **Publicado (GitHub Pages):** abrir `https://<usuario>.github.io/<repositorio>/juego.html` en el computador y escanear el QR con el teléfono.
- **En local:** `npm install` y `node server.js`; abrir la dirección que muestra la consola. El servidor local también sirve el QR con la IP de la red.
- **Broker:** editar `config.js` con la dirección `wss://…:8084/mqtt`, usuario y contraseña de EMQX. En GitHub Pages este archivo es público: usa una cuenta creada solo para este juego.
