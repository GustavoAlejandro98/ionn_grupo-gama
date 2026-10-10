# IONN Consulting · Sprints 1 a 4

Experiencia completa: homepage, chat, WhatsApp y el Diagnóstico de Crecimiento con el IONN Growth Score™. Mockup en evaluación. **No toca el sitio en producción.**

## Cómo verlo

Haz doble clic en `index.html`. Se abre en tu navegador y funciona completo, sin servidor y sin internet (si estás sin conexión, la tipografía cae al tipo del sistema; todo lo demás corre igual).

## Las seis secciones

| | Sección | Lo que pasa al bajar |
|---|---|---|
| 01 | **Hero** | Cinco lugares rodean tu negocio, cada uno con su ícono y lo que pasa ahí: Google *te buscan*, Web *te conocen*, Redes *te revisan*, Marca *te comparan*, IA *te recomiendan*. Las señales viajan **hacia adentro**: te están evaluando. |
| 02 | **Tu cliente** | El camino avanza horizontalmente en cinco etapas, siempre en plural: te buscan → te conocen → te revisan → te comparan, y una quinta —te recomienda— marcada como nueva puerta de entrada (IA). Cada etapa cuelga del mismo canal del orbe del Hero ("A través de Google te buscan"). La línea se dibuja conforme bajas. |
| 03 | **Una visión de negocio** | Las cinco capacidades se conectan una por una alrededor de **CRECIMIENTO**, que se enciende en verde cuando la quinta llega. Mismo lenguaje visual que el Hero: los reconoces. |
| 04 | **Cómo trabajamos** | Una línea avanza por entender → encontrar → construir → mejorar. Cada etapa se enciende al llegar. |
| 05 | **Historias de crecimiento** | Contadores animándose de cero. Un caso destacado con reto → lo que hicimos → resultado, más tres tarjetas y un espacio reservado. |
| 06 | **CTA final** | Los puntos del Hero regresan y convergen en **OPORTUNIDAD**. Mismo botón que el Hero: "Evalúa tu presencia actual". |
| — | **Footer** | Soluciones, IONN, legal y redes. |

*Insights se quitó del sitio (2026-08-25) hasta tener una fuente real de contenido — ver "Pendiente, no cancelado" más abajo.*

Detrás de todo corre el campo de constelación, que cambia de forma al cambiar de sección: se agrupa alrededor del negocio en el Hero, se abre en El Cambio, se cierra otra vez en el CTA final.

## Los dos canales

Abajo a la derecha, en las dos páginas, viven el **asesor digital** y **WhatsApp**. Deliberadamente distintos: el chat es un círculo cyan de 56 px con una burbuja de conversación y una chispa dentro —lo que la gente ya reconoce como chat, más el signo que hoy significa "esto responde con IA"—; WhatsApp es una pastilla más chica, con la palabra y un acento verde. El chat es "quiero resolver una duda"; WhatsApp es "quiero hablar con alguien". No compiten.

**El chat funciona hoy, sin configurar nada.** Trabaja en modo guiado: responde las seis preguntas sugeridas con respuestas que escribimos con la voz de IONN. Cuando conectes la llave de Gemini pasa a conversar de verdad. Y si la llave falla, se cae Google o no hay internet, regresa solo al modo guiado — **el visitante nunca ve un error**.

Tres reglas que quedaron cableadas y verificadas:

- El puente al diagnóstico **nunca aparece en la primera respuesta** y **nunca se repite**. Solo sale cuando la persona ya dio contexto y la recomendación tiene sentido.
- El chat **no da precios, no promete resultados y no inventa datos** de tu negocio ni de IONN. Pregunta cuando le falta contexto.
- Hay una **lista negra de vocabulario** en el prompt: soluciones 360, transformación digital, sinergias, ecosistema, llevar tu negocio al siguiente nivel, engagement, storytelling. El modelo tiene prohibido usarlas.

Para encender la IA: **`CONFIGURAR-IA.md`**, escrito paso a paso sin tecnicismos.

## El diagnóstico y el IONN Growth Score™

`diagnostico.html`. **Dos pasos**, uno de análisis y el resultado. Toma 3 minutos y lo dice desde el principio. La entrada es de dos columnas: la promesa a la izquierda, y a la derecha lo que revisamos, el botón y los tres hechos que quitan fricción — 3 minutos, sin costo, resultado inmediato. No hay que hacer scroll para entender ni para empezar. Arriba, un porcentaje discreto dice cuánto falta. Y mientras lees el resultado, un CTA flotante te sigue: si te convence a la mitad, no tienes que bajar hasta el final.

**Cómo puntúa.** El motor es determinista y vive en `assets/js/score.js`. Cada dimensión tiene cuatro señales con su peso; el puntaje es la suma de las señales presentes. No inventa un análisis que no hizo: mide **presencia y consistencia** de lo que la persona declara, no la calidad de lo que hay dentro. Por eso ninguna dimensión llega a 100 sin que alguien haya mirado de verdad — hay un techo del 92%. Cuando enciendas la llave de Gemini, `api/diagnostico.js` sí lee la página en vivo y reemplaza las interpretaciones por las suyas.

**Sin página web no hay castigo.** Web sale como *No evaluable*, su peso se reparte entre las demás y el negocio puede sacar 70 sin tener página. Lo verifiqué con tres perfiles:

| Perfil | Comparte | Resultado |
|---|---|---|
| Negocio completo | web, IG, FB, Google, marca | **84** · Bien posicionado · 5 de 5 dimensiones |
| Solo redes | Instagram y Google | **52** · En crecimiento · Web *No evaluable* |
| No sabe qué tiene | nada | **0** · Por construir · con una nota que dice que el número habla de lo que no vimos |

**Las tres oportunidades son dinámicas**, no una lista fija: `brecha × peso × facilidad de mejora`. Arreglar una ficha de Google pesa más que rehacer una marca porque se mueve más rápido. Y hay una regla transversal: si tus canales están muy desparejos, se inyecta la oportunidad **Conexión**, porque ahí el problema no es ninguna dimensión sino que trabajan por separado. El encabezado se adapta: si solo sale una, dice "tu principal oportunidad".

**El formulario va al final.** Primero el score, luego el desglose, luego las oportunidades, luego qué significa. Recién entonces se piden los datos, y el botón arma un WhatsApp con el diagnóstico dentro para que solo le des enviar.

### Sobre los colores de los niveles

El brief pedía rojo → naranja → amarillo → verde → azul. Lo probé con un validador de accesibilidad y **falla**: naranja y rojo quedan a ΔE 12.8, por debajo del piso de 15 — son difíciles de distinguir incluso con visión de color normal, y peor con daltonismo.

La escala que quedó pasa todas las pruebas y además evita el tono de auditoría que el propio brief pedía evitar: va de oportunidad a madurez, no de malo a bueno.

| Nivel | Color | |
|---|---|---|
| 0–29 · Por construir | Ámbar profundo | `#FF8C42` |
| 30–49 · En desarrollo | Ámbar claro | `#FFD84D` |
| 50–69 · En crecimiento | Cyan | `#18E0FF` |
| 70–84 · Bien posicionado | Verde | `#2BFF95` |
| 85–100 · Potencial alto | Violeta | `#9D5CFF` |

Sin rojo. Cada nivel lleva **siempre** su etiqueta de texto: el color nunca es lo único que comunica.

### Las nueve preguntas

Las preguntas conversacionales que me diste están respondidas en HTML nativo al final de la promesa, y alimentan el marcado `FAQPage`. Son exactamente lo que alguien le escribe a ChatGPT antes de contratar a nadie, y desde ahí el camino lleva al diagnóstico.

## Sobre el orbe del Hero

Tomé tu referencia y me quedé con lo que suma: subtítulo por punto de contacto, anillos concéntricos, íconos y señales viajando por los radios.

Lo que **no** tomé, y por qué:

- **Los biseles, esferas 3D y sombras duras.** Tu guideline dice textual: *diseño plano con resplandores suaves, sin sombras duras, biseles o contornos extra.* La profundidad aquí la dan cuatro anillos con opacidad decreciente, no un relieve.
- **Los logos de Google, Meta, WhatsApp, ChatGPT y Gemini.** Dos razones: usar marcas de terceros en tu página tiene implicaciones legales, y visualmente le regalan el protagonismo a ellos. Los sustituí por íconos de línea de 1.5 px en tu propio lenguaje.
- **Los resplandores azul, dorado, morado y verde a la vez.** Rompen el 70/20/10 y la regla de un solo neón protagonista por sección. Aquí manda el cyan; el violeta es solo el nodo IA y el verde solo el Cliente, que es el resultado.

## Marcadores visibles

Dos bloques traen una etiqueta violeta punteada que dice qué falta:

- **Historias de crecimiento** — las cifras (+127%, +84%, 3.2×, +63%, 2.4×, +91%) son de ejemplo. Sustituirlas es cambiar un número en `data-count` dentro del HTML.

Nada se publica como dato real hasta que tú lo confirmes.

## Pendiente, no cancelado

**Insights** salió del sitio a tu pedido (2026-08-25): no había fuente real de contenido ni forma de mantenerlo actualizado sin cargarlo a mano. Cuando quieras retomarlo, la opción que platicamos es una función programada (cada dos semanas) que junte notas reales sobre IA/Google/marca y las resuma — no que la IA las invente sin fuente. El HTML y CSS de esa sección quedaron fuera del sitio pero documentados en el historial de la conversación, listos para reinstalar cuando decidas avanzar.

**Subida de archivos en el diagnóstico** también quedó pendiente: hoy `api/diagnostico.js` solo lee la URL del sitio del visitante, no documentos que suba. Es una función nueva por construir cuando la necesites.

## Qué revisar

1. **El orbe del Hero en tu teléfono.**
2. **El violeta del titular.** Sigue ocupando la mitad de la frase. Es una línea de CSS si lo quieres menos.
3. **La sección 03.** Reconocer que son los mismos cinco puntos del Hero es el momento clave de la página.
4. **El chat.** Ábrelo y recorre las seis preguntas. Fíjate si suena a consultor o a bot. El símbolo del botón tiene tres alternativas listas en un comentario de `index.html`, justo encima del glifo.
5. **El diagnóstico completo.** Recórrelo con tres negocios distintos: uno con todo, uno que solo tenga redes y uno sin nada. Fíjate sobre todo en que el que no tiene página web no se sienta castigado.
6. **El copy nuevo:** las cinco micro-frases del recorrido, los seis subtítulos del orbe y las frases de cierre de cada sección.

## Archivos

```
index.html              Homepage · 6 secciones
diagnostico.html        Diagnóstico completo + Growth Score + FAQ
vercel.json             Hosting + noindex
robots.txt              Bloqueado mientras sea mockup
assets/css/styles.css   Sistema de diseño completo
assets/js/main.js       Splash, nav, recorrido, proceso, contadores
assets/js/field.js      Campo ambiental
assets/js/chat.js       Asesor digital y WhatsApp
assets/js/score.js      Motor del diagnóstico y del Growth Score
assets/css/diagnostico.css
api/chat.js             Proxy seguro hacia Gemini (la llave vive aquí)
api/diagnostico.js      Capa de IA del diagnóstico (lee la página en vivo)
CONFIGURAR-IA.md        Cómo encender la IA, paso a paso
```

## Notas técnicas

- Sin librerías externas. Sin paso de compilación. Sin `node_modules`. Todo pesa 184 KB, imágenes incluidas (no hay ninguna).
- Todo el JavaScript va en IIFE bajo `window.__IONN__` y cada pieza está aislada: si una falla, el resto sigue funcionando.
- Todo el texto está en HTML nativo. Puedes editar cualquier frase abriendo el archivo sin romper nada.
- Con el JavaScript desactivado la página sigue siendo legible.
- Con "reducir movimiento" activado, El Cambio se convierte en lista vertical, el proceso aparece completo y los contadores muestran su valor final sin animarse.
- No hay una sola imagen de stock. Todo lo visual se dibuja con CSS/SVG, así que no hace falta página de créditos fotográficos.
- `robots.txt` y `vercel.json` bloquean la indexación mientras esto sea mockup. Se retira al aprobar producción.

## Pendientes que ya te pedí

Números reales de casos · URLs de Instagram y LinkedIn · correo y WhatsApp definitivos · aviso de privacidad y términos.

## Siguiente

**QA y despliegue** — Revisión final de responsividad, performance y accesibilidad, y publicación del mockup en un proyecto de Vercel nuevo, con `noindex`, sin dominio y sin tocar producción. En curso.

Sigue pendiente de tu lado: los números reales de casos, las URLs de Instagram y LinkedIn, el correo y el WhatsApp definitivos, y el aviso de privacidad — nada de esto bloquea el despliegue de prueba, solo el paso a producción real.
