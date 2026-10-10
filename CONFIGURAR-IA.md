# Encender el chat con IA

El chat ya funciona hoy. Trabaja en **modo guiado**: responde las seis preguntas sugeridas con respuestas que escribimos nosotros. Sirve para revisar el diseño y el tono, y sirve para tus clientes si nunca conectas la IA.

Para que converse de verdad —que entienda lo que la persona escribe y responda a su caso— hay que darle una llave de Google. Son cinco minutos.

---

## Paso 1 · Sacar la llave

1. Entra a **aistudio.google.com** con tu cuenta de Google.
2. Busca el botón que dice **Get API key** (arriba a la izquierda).
3. Dale a **Create API key**.
4. Copia la llave que aparece. Es un texto largo que empieza con `AIza...`.

**Guárdala como guardarías una contraseña del banco.** Quien la tenga puede gastar de tu cuenta. No la pegues en WhatsApp, ni en un correo, ni en un documento compartido.

---

## Paso 2 · Ponerla en Vercel

1. Entra a **vercel.com** y abre el proyecto de la web nueva.
2. Arriba, dale a **Settings**.
3. En el menú de la izquierda, **Environment Variables**.
4. Llena dos campos:
   - **Key** (nombre): `GEMINI_API_KEY`
   - **Value** (valor): la llave que copiaste
5. Deja marcadas las tres casillas (Production, Preview, Development).
6. **Save**.

---

## Paso 3 · Volver a publicar

Vercel no aplica la llave hasta que la página se publica otra vez.

1. Ve a la pestaña **Deployments**.
2. En el despliegue de hasta arriba, dale a los tres puntitos **⋯**.
3. **Redeploy** → confirma.

Espera un minuto. Entra a la web, abre el chat y escríbele algo que **no** sea una de las seis preguntas sugeridas, por ejemplo *"vendo maquinaria y casi no me llegan clientes"*.

- Si te responde con algo pensado para tu caso → **quedó encendido.**
- Si te responde *"ahorita estoy en modo guiado"* → la llave no llegó. Revisa que el nombre esté escrito exactamente `GEMINI_API_KEY` y que hayas hecho el Redeploy.

---

## Cuánto cuesta

Google tiene un nivel gratuito con un tope de mensajes al día. Para una web que empieza suele alcanzar de sobra. Si algún día lo pasas, Google te avisa y tú decides si activas cobro.

Tres cosas que ya dejamos puestas para que no haya sustos:

- **Tope por visitante**: máximo 25 mensajes cada diez minutos desde una misma conexión.
- **Tope por mensaje**: 700 caracteres. Nadie puede pegarte un libro completo.
- **Memoria corta**: el chat solo reenvía los últimos 12 mensajes de la conversación, no toda la historia.

---

## Si algo se cae

El chat **nunca le muestra un error a tu cliente**. Si Google no responde, si se acaba la cuota o si se cae el internet, el chat regresa solo al modo guiado y sigue conversando con las respuestas escritas. La persona ni se entera.

---

## Cambiar lo que dice el chat

**Las respuestas del modo guiado** están en `index.html`, casi hasta abajo, dentro de un bloque que dice `<template id="chatKB">`. Cada pregunta es un bloque `<article>` y cada párrafo va entre `<p>` y `</p>`. Puedes editarlas con cualquier editor de texto, sin tocar nada más.

**Las seis preguntas sugeridas** están un poco más arriba, en el bloque `chat__suggest`. Si cambias una pregunta ahí, cambia también el `data-q` del `<article>` que le corresponde para que sigan emparejados.

**La personalidad del chat con IA** vive en `api/chat.js`, en el bloque `SYSTEM_PROMPT`. Ahí está escrito quién es IONN, cómo habla, qué palabras usa, qué palabras tiene prohibidas y cuándo puede ofrecer el diagnóstico. Si quieres afinar el tono, ese es el lugar — pero avísame y lo hacemos juntos, porque ahí es fácil romper las reglas de marca sin darse cuenta.

---

## Cambiar el número de WhatsApp

Está en dos archivos: `index.html` y `diagnostico.html`. Busca `wa.me/522296478519` y cambia el número. Va sin `+`, sin espacios y sin guiones: código de país pegado al número.
