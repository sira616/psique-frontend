# Política de privacidad

Esta política explica qué datos trata Psique, para qué, con quién se comparten y cómo ejercer tus derechos según el Reglamento General de Protección de Datos (RGPD).

## 1. Responsable

**[RESPONSABLE]**. Contacto para cualquier cuestión de privacidad: **[EMAIL DE CONTACTO]**.

## 2. Qué datos guardamos

**Cuenta**

- Nombre de usuario y contraseña. La contraseña se guarda solo como **hash Argon2**: no la conocemos ni podemos recuperarla. **No pedimos correo electrónico.**
- Fecha y versión de los términos que aceptaste, y fecha en que declaraste ser mayor de edad (si lo hiciste).
- Sesiones abiertas (tokens de refresco), para mantenerte dentro sin volver a escribir la contraseña.

**Perfil**

- Nombre visible, handle (tu dirección pública), bio, enlace, y la privacidad que elijas para tus estanterías.
- Avatar y banner. Las imágenes que subes **se vuelven a codificar en el servidor a WebP** a partir de los píxeles, así que **se descartan los metadatos EXIF** (como la ubicación de la foto).

**Lo que haces en Psique**

- Tus historias propias (privadas salvo que las publiques en Explorar).
- Tus partidas: los mensajes que escribes y los que genera el personaje, los resúmenes de la conversación, los hechos que el personaje recuerda de ti, las escenas y sugerencias, y los eventos de la historia (fases, afinidad, capítulos).
- Tus reseñas de libros.
- Tus óbolos (movimientos del saldo), tus tarjetas de Rasca y gana y el cupo diario de turnos que has usado.

**Moderación**

- Cuando un mensaje cierra una partida se registra un **incidente de conducta** (fecha, nivel, regla, partida) y un **extracto del mensaje de hasta 300 caracteres**. El extracto **solo lo ve el equipo de revisión** (y tú, en la copia de tus datos), **se borra al resolverse** el incidente y, si no, **deja de mostrarse a los 30 días** y se elimina en la limpieza periódica siguiente.
- Si apelas, guardamos el texto de la apelación y el resultado de la revisión.

**Datos técnicos**

- Tu **dirección IP** solo se usa en **contadores temporales anti-abuso** (límites de peticiones) que duran minutos. No se guarda en tu cuenta.

## 3. Para qué y con qué base

- **Crear y mantener tu cuenta, tus historias y partidas, y generar las respuestas:** ejecución del contrato (los términos de uso).
- **Moderar el contenido y aplicar las normas** (cierres, pausas, apelaciones): interés legítimo en ofrecer un servicio seguro y cumplimiento de obligaciones legales.
- **Proteger el servicio frente a abusos** (límites de peticiones, sesiones): interés legítimo.
- **Registrar la aceptación de los términos y las declaraciones de edad:** cumplimiento legal e interés legítimo.

No usamos tus datos para publicidad ni para crear perfiles comerciales, y no los vendemos.

## 4. Proveedores de inteligencia artificial

Para que el personaje responda, y para moderar lo que escribes, resumir la conversación y extraer los hechos que el personaje recuerda, **enviamos los textos necesarios a un proveedor de modelos de lenguaje**. Según la configuración del servicio puede ser:

- **Ollama Cloud**;
- **Anthropic (Claude)**;
- o un **modelo local** que funciona en nuestros propios equipos, sin salir a terceros.

Proveedor en uso hoy: **[PROVEEDOR ACTUAL]**.

Estos proveedores actúan como encargados del tratamiento y procesan los textos para devolver la respuesta. Algunos pueden estar **fuera del Espacio Económico Europeo**; en ese caso la transferencia se ampara en las garantías que prevé el RGPD (por ejemplo, decisiones de adecuación o cláusulas contractuales tipo). No incluyas en tus mensajes datos personales que no quieras compartir.

## 5. Quién más ve tus datos

- **Otras personas** ven tu perfil público (nombre visible, handle, bio, enlace, avatar, banner), las historias que publiques, tus reseñas y las estanterías que tengas visibles.
- **El equipo de revisión** ve los incidentes de moderación y, mientras existe, su extracto.
- Nadie más, salvo obligación legal.

## 6. Cuánto tiempo

- Los datos de tu cuenta y tu actividad, mientras la cuenta exista.
- El extracto de un incidente, como mucho 30 días.
- Los contadores anti-abuso por IP, minutos.
- Las sesiones caducan a los 30 días o al cerrar sesión.

## 7. Cookies y almacenamiento local

- Usamos **una sola cookie**: `psique_refresh`, para mantener la sesión iniciada. Es **httpOnly** (el código de la página no puede leerla), **SameSite=Strict** y dura **30 días**. Es técnica y necesaria para mantener la sesión, así que no requiere consentimiento.
- En el **almacenamiento local del navegador** guardamos solo tu preferencia de **tema claro u oscuro** (`psique-ui`). No sale de tu dispositivo.
- **No hay cookies de analítica ni de publicidad.**

## 8. Tus derechos

Puedes ejercer los derechos de acceso, rectificación, supresión, oposición, limitación y portabilidad:

- **Portabilidad y acceso:** en **Configuración → Tus datos** puedes **descargar una copia de tus datos en JSON**.
- **Rectificación:** puedes cambiar tu perfil desde Configuración.
- **Supresión:** puedes **borrar tu cuenta** desde Configuración confirmando con tu contraseña. Se borran tu cuenta, tu perfil, tus imágenes, tus partidas y el resto de tu actividad, y también las historias propias que nadie más jugó. Las historias tuyas que otras personas ya habían empezado **se despublican y quedan sin autor** (anónimas, sin relación contigo) para que esas personas puedan terminar sus partidas; se borran cuando ya no queda ninguna.
- Para cualquier otra petición, escríbenos a **[EMAIL DE CONTACTO]**.

Si crees que no hemos tratado bien tus datos, puedes reclamar ante la **Agencia Española de Protección de Datos** (aepd.es).

## 9. Menores

Psique es para personas de **16 años o más**. Si detectamos una cuenta de alguien menor de esa edad, la borraremos.

## 10. Cambios

Si cambiamos esta política de forma relevante, te pediremos que aceptes la versión nueva al entrar.
