# Arquitectura local segura

> **Documento histórico.** Conserva la conversación original y puede contener decisiones sustituidas, especialmente sobre QR, conflictos y PIN. Para los acuerdos vigentes, consulta [la especificación funcional](../ESPECIFICACION-FUNCIONAL.md) y [la arquitectura consolidada](08-arquitectura-tecnica.md).

- Proyecto de origen: ChatGPT / Pablo Tablet
- ID de conversación: `6aaa724b-b314-83ed-8f64-432421ddf436`
- Creado: 2026-09-16T10:41:17.303Z
- Actualizado: 2026-09-16T12:04:31.841Z

---

## Usuario

Arquitectura local, QR y seguridad

## Asistente

Perfecto. Dejamos este hilo de **Pablo Tablet** dedicado a **arquitectura local, emparejamiento por QR y seguridad**.

Como base, partiría de esta arquitectura:

- **Tablet como servidor principal local**: la información del panel vive en la tablet y debe seguir funcionando aunque se caiga Internet.
- **Móvil como cliente de administración**: desde el móvil podrás editar notas, calendario, widgets, configuración, ciudades del tiempo, etc.
- **Comunicación por red local** mediante una API servida por la tablet, evitando depender de un backend externo para las funciones básicas.
- **Emparejamiento inicial mediante QR**: la tablet muestra un QR temporal y el móvil lo escanea para vincularse.
- El QR no debería contener una contraseña permanente, sino algo parecido a `IP/host + token temporal + identificador del dispositivo`.
- Tras emparejarse, se genera una **credencial permanente específica para ese móvil**, almacenada de forma segura.
- Posibilidad de **revocar dispositivos vinculados** desde la tablet.
- API protegida mediante autenticación en todas las operaciones de escritura.
- Tokens largos y aleatorios, con expiración para los tokens de emparejamiento.
- Contraseñas/PIN, claves y tokens almacenados cifrados o usando el **Android Keystore** cuando lleguemos a la aplicación Android real.
- Copias de seguridad locales, tanto automáticas como descargables, tal y como definimos anteriormente.
- Nada crítico debería quedar expuesto simplemente porque alguien conozca la IP de la tablet.

Para el funcionamiento del QR, mi opción preferida sería:

**Tablet → “Vincular dispositivo” → QR válido durante 2-5 minutos → móvil escanea → tablet pide confirmar → se crea el dispositivo → QR queda invalidado.**

Así evitamos que una foto antigua del QR permita acceder posteriormente.

También separaría desde el principio tres niveles de acceso: **visualización**, **administración normal** y **administración sensible** (seguridad, dispositivos vinculados, restaurar copias, borrar datos, etc.).

Este hilo lo podemos usar para cerrar decisiones como **HTTP/HTTPS local, descubrimiento de la tablet, API, WebSocket, estructura de datos, tokens, QR, PIN, usuarios, backups y acceso desde fuera de casa**.

## Usuario

https://chatgpt.com/share/6aaa728f-ba28-83eb-a0b7-aff3359efef7 
Usa esta conversación únicamente como contexto del proyecto **Pablo Tablet**. No hagas nada todavía, no desarrolles código ni tomes nuevas decisiones. Limítate a confirmar que has entendido el contexto y espera mis siguientes instrucciones.

## Asistente

Entendido. Usaré esa conversación únicamente como contexto del proyecto **Pablo Tablet** y no haré nada más hasta que me des nuevas instrucciones.

## Usuario

Dime qué hay que aclarar antes de empezar

## Asistente

Antes de empezar con **arquitectura local, QR y seguridad**, yo cerraría estas decisiones. No hace falta definir hasta el último detalle, pero sí estas bases para no rehacer luego media aplicación.

### Imprescindible antes de desarrollar

1. **Dónde vive realmente la aplicación**
   - ¿La tablet ejecuta una app Android nativa?
   - ¿O ejecuta una web local/PWA dentro de WebView/navegador?
   - ¿El móvil entra mediante navegador o tendrá también app propia?

2. **Quién actúa como servidor**
   - Mi propuesta actual sería: **la tablet es el servidor y el móvil es cliente**.
   - Hay que confirmar que no habrá un servidor externo obligatorio.

3. **Cómo encuentra el móvil a la tablet**
   Hay que elegir un mecanismo principal:
   - IP local incluida en el QR.
   - Nombre local tipo `pablotablet.local`.
   - Descubrimiento automático con mDNS/NSD.
   
   Recomendaría **mDNS + IP como fallback**.

4. **Qué ocurre si cambia la IP de la tablet**
   Esto es importante porque con DHCP puede cambiar.
   - El móvil debe poder reencontrarla automáticamente.
   - No deberíamos depender de guardar `192.168.1.54` para siempre.

5. **Contenido exacto del QR**
   Definir si incluye:
   - Identificador de tablet.
   - Dirección local.
   - Token temporal.
   - Versión del protocolo.
   
   No debería incluir ninguna contraseña permanente.

6. **Duración del QR**
   Hay que decidir:
   - 1 minuto.
   - 2 minutos.
   - 5 minutos.
   
   Yo usaría **2 minutos** y de un solo uso.

7. **Confirmación del emparejamiento**
   Elegir entre:
   - Escanear QR = acceso inmediato.
   - Escanear QR + confirmación en tablet.
   - QR + PIN.
   
   Para casa, considero equilibrado:
   
   **QR → aparece petición en tablet → Aceptar/Rechazar.**

8. **Cuántos móviles pueden vincularse**
   - Uno.
   - Varios.
   - Sin límite práctico.
   
   Mi recomendación sería varios dispositivos, cada uno con su propia credencial.

9. **Gestión de dispositivos vinculados**
   Necesitamos una pantalla del estilo:
   - Pixel 9 — conectado.
   - Tablet de X.
   - Último acceso.
   - Revocar acceso.
   - Revocar todos.

10. **Permisos**
    Hay que decidir si todos los móviles vinculados pueden hacer lo mismo o existen roles.
    
    Para el MVP podríamos simplificar a:
    - **Administrador**
    - **Solo lectura**
    
    O incluso solo administrador inicialmente.

---

### Seguridad que conviene decidir ahora

11. **HTTP o HTTPS dentro de la LAN**
    
    HTTPS local es más seguro, pero añade complejidad por certificados.
    
    Hay tres caminos:
    - HTTP local + tokens.
    - HTTPS con certificado autofirmado.
    - HTTPS con certificado propio/confiable.
    
    Hay que escoger uno antes de montar la API.

12. **Cómo se autentica el móvil después del QR**
    
    Recomendaría que después del emparejamiento se cree un token aleatorio específico para ese dispositivo, por ejemplo:

    `mobileId + accessToken`

    El QR solo sirve para obtener esa credencial.

13. **Dónde guardar las credenciales**
    
    En la tablet Android:
    - Android Keystore.
    
    En móvil:
    - almacenamiento seguro si hay app;
    - si es web, tendremos que definir cómo proteger la sesión.

14. **Caducidad de las sesiones**
    Elegir:
    - Nunca caducan hasta revocarlas.
    - Caducan cada X meses.
    - Se renuevan automáticamente.
    
    Para un dispositivo doméstico tiene sentido una sesión larga y revocable.

15. **Protección de operaciones peligrosas**
    
    Definir si acciones como:
    - restaurar backup,
    - borrar datos,
    - desvincular dispositivos,
    - resetear la tablet
    
    requieren PIN o confirmación adicional.

---

### Arquitectura local

16. **Tipo de API**
    
    Probablemente:
    - REST para configuración y datos.
    - WebSocket para cambios en tiempo real.
    
    Hay que confirmar si queremos actualizaciones instantáneas móvil → tablet.

17. **Quién es la fuente de verdad**
    
    Yo dejaría:
    
    **Tablet = fuente de verdad.**
    
    El móvil únicamente consulta/modifica los datos de la tablet.

18. **Base de datos local**
    
    Hay que elegir:
    - SQLite.
    - Room sobre SQLite.
    - JSON/archivos.
    
    Si acabamos en Android nativo, **Room + SQLite** sería lo lógico.

19. **Qué pasa con varios móviles editando a la vez**
    
    Para el MVP puede ser simplemente:
    
    **última modificación gana**.
    
    No necesitamos montar resolución compleja de conflictos.

20. **Funcionamiento sin Internet**
    
    Ya tenemos bastante claro que la tablet debe continuar funcionando.
    
    Falta concretar qué módulos sí requieren Internet:
    - tiempo;
    - Google Calendar;
    - fotos externas;
    - otros servicios futuros.
    
    Pero un fallo de Internet nunca debería bloquear el panel.

---

### Recuperación y mantenimiento

21. **Qué pasa si se pierde el móvil**
    
    Debe poder revocarse desde la tablet.

22. **Qué pasa si se pierde toda vinculación**
    
    La tablet necesita siempre una forma local de:
    - mostrar un nuevo QR;
    - resetear dispositivos autorizados.

23. **Reset completo**
    
    Definir si existirá:
    
    `Ajustes → Sistema → Restablecer Pablo Tablet`

24. **Contenido del backup**
    
    Determinar si contiene también:
    - configuraciones;
    - notas;
    - widgets;
    - fotos;
    - dispositivos vinculados;
    - credenciales de Google/API.
    
    Yo **no copiaría tokens de acceso de dispositivos vinculados** dentro del backup.

---

### Lo que NO necesitamos cerrar todavía

Podemos dejar para más adelante el acceso desde fuera de casa, cuentas de usuario en la nube, sincronización entre varias tablets, cifrado extremo a extremo, dominio propio, VPN/Tailscale y similares.

Para un **MVP completamente funcional**, las decisiones realmente bloqueantes son **1, 3, 5, 7, 8, 11, 12, 16, 17 y 18**.

Si quieres, podemos hacer lo mismo que en el otro hilo: **te voy preguntando una por una con 3-4 opciones y vamos cerrando toda esta parte hasta que quede lista para desarrollar**.

## Usuario

Si

## Asistente

Perfecto. Vamos una por una y voy cerrando decisiones.

### 1. ¿Dónde quieres que viva la aplicación principal?

**1)** App Android nativa en la tablet + app móvil aparte.  
**2)** App Android nativa en la tablet + móvil accede desde navegador web.  
**3)** Todo como web/PWA, tanto tablet como móvil.  
**4)** Híbrido: app Android en la tablet con WebView para la interfaz + móvil por navegador.

Para este proyecto, de entrada, **la 2 o la 4** son las más prácticas.

Respóndeme solo con **1, 2, 3 o 4**.

## Usuario

A ver, yo había pensado más rollo de que sea... En el móvil no es nada, es solo todo se configura desde web, ¿vale? Y desde la tablet realmente sí me da un poco igual que sea nativa o no. La cosa es que parezca que cuando se abra no sea como una capa por encima del sistema operativo. Si se puede tapar todo lo más posible, mejor. Ahí ya me da igual si es una aplicación o una web.

## Asistente

Sí, entonces lo dejaría definido así:

**Decisión 1 cerrada:**  
- **Móvil:** no tendrá app. Toda la configuración se hará desde una **web local** accesible desde el navegador.
- **Tablet:** la interfaz puede ser web, pero debe ejecutarse de forma que **parezca una aplicación dedicada**, ocultando al máximo Android: sin barra de navegación visible, sin navegador, sin pestañas, sin controles del sistema salvo cuando sea necesario.
- Para empezar, lo más lógico es hacer la interfaz como **web/PWA a pantalla completa** y, si Android nos limita demasiado, envolverla después en una app mínima tipo **WebView/kiosk**. Así no condicionamos todo el proyecto desde el principio.

La idea visual sería prácticamente:

**enciendes tablet → arranca Pablo Tablet → pantalla completa → no parece que estés “dentro de Android”**.

### 2. ¿Dónde quieres que corra el servidor local?

**1)** En la propia tablet. El móvil se conecta directamente a ella por la red Wi-Fi.  
**2)** En otro dispositivo de casa, como un PC/Raspberry Pi/NAS.  
**3)** En Internet/cloud.  
**4)** Tablet como servidor principal, pero dejando preparado poder añadir cloud más adelante.

Para lo que hemos planteado hasta ahora, yo elegiría **4**: tablet como servidor local y cloud opcional en el futuro.

## Usuario

1

## Asistente

Perfecto.

**Decisión 2 cerrada:** la **tablet será el servidor local**. El móvil se conectará directamente a ella por la red Wi-Fi de casa, sin depender de un PC, Raspberry Pi ni servidor externo.

### 3. ¿Cómo quieres que el móvil encuentre la tablet?

**1)** Solo mediante el QR, que incluye la dirección necesaria para conectarse.  
**2)** Mediante una dirección fija tipo `pablotablet.local`.  
**3)** Descubrimiento automático en red local + dirección tipo `pablotablet.local`.  
**4)** Todo lo anterior: descubrimiento automático, nombre local y QR como método rápido/fallback.

Yo elegiría **4**, porque evita depender de una IP concreta y hace el acceso mucho más cómodo.

Respóndeme con **1, 2, 3 o 4**.

## Usuario

Qr, pero al escearlo, saldría mensaje/popup en la tablet para añadir dispositivo x co confirmación

## Asistente

Perfecto. Entonces dejamos cerradas dos cosas a la vez:

- **Descubrimiento:** mediante **QR**.
- **Emparejamiento:** al escanearlo desde el móvil, la tablet muestra un aviso tipo **“¿Quieres añadir este dispositivo?”** con opción de **Aceptar / Rechazar**.
- Hasta que no se confirme en la tablet, el móvil no obtiene acceso.
- El QR será temporal y no dará acceso permanente por sí solo.

### 4. Después de vincular un móvil, ¿quieres que tenga que escanear el QR cada vez?

**1)** Sí, siempre QR.  
**2)** No, una vez aceptado queda vinculado y podrá volver a entrar automáticamente mientras no se revoque.  
**3)** Queda vinculado, pero cada cierto tiempo vuelve a pedir QR.

Yo elegiría **2**.

## Usuario

No, eso es solo para añadir dispositivo o recargarlo por si se desconecta

## Asistente

Perfecto, entonces queda así:

- El **QR no se usa en cada acceso**.
- Sirve para **añadir un dispositivo nuevo**.
- También puede usarse para **recuperar/reconectar un dispositivo ya vinculado** si pierde la sesión o deja de poder acceder.
- Una vez autorizado, el móvil entra normalmente sin volver a escanear nada.
- Si se usa el QR para reconectar, la tablet volverá a mostrar la confirmación antes de dar acceso.

### 5. ¿Cuántos móviles/dispositivos quieres permitir vinculados a la vez?

**1)** Solo uno.  
**2)** Varios, sin límite práctico.  
**3)** Varios, pero con un máximo fijo.  
**4)** Varios y que desde la tablet se pueda ver la lista y revocar cualquiera.

Yo elegiría **4**.

## Usuario

4

## Asistente

Perfecto.

**Decisión 5 cerrada:** se podrán vincular **varios dispositivos** y desde la tablet habrá una lista con:
- nombre o identificador del dispositivo,
- última conexión,
- estado,
- opción para **revocar acceso** individualmente.

### 6. ¿Todos los dispositivos vinculados tendrán los mismos permisos?

**1)** Sí, todos pueden configurar absolutamente todo.  
**2)** Dos niveles: **Administrador** y **Solo lectura**.  
**3)** Varios niveles: administrador, edición normal y solo lectura.  
**4)** Permisos configurables por dispositivo.

Para no complicar demasiado el MVP, yo elegiría **2** o **3**.

## Usuario

Si

## Asistente

Perfecto.

**Decisión 6 cerrada:** todos los dispositivos vinculados tendrán **los mismos permisos**. Para el MVP no habrá roles ni permisos distintos por dispositivo.

### 7. ¿Quieres proteger algunas acciones sensibles con un PIN adicional en la tablet?

Por ejemplo:
- borrar todos los datos,
- restaurar una copia,
- revocar todos los dispositivos,
- restablecer la aplicación.

**1)** No, con confirmar en pantalla basta.  
**2)** Sí, PIN solo para acciones sensibles.  
**3)** PIN para entrar en cualquier ajuste.  
**4)** PIN opcional, configurable por el usuario.

Yo elegiría **4**.

## Usuario

2

## Asistente

Perfecto.

**Decisión 7 cerrada:** habrá un **PIN obligatorio para acciones sensibles**, como:
- borrar todos los datos,
- restaurar una copia de seguridad,
- revocar todos los dispositivos,
- restablecer la aplicación.

Para el resto de ajustes normales no hará falta PIN.

### 8. ¿Cómo quieres proteger la conexión entre móvil y tablet dentro de la red local?

**1)** HTTP local + token de autenticación. Más simple.  
**2)** HTTPS local con certificado propio/autofirmado. Más seguro, pero puede dar avisos o complicar el acceso desde navegador.  
**3)** Empezar con HTTP + token en el MVP y dejar preparada la arquitectura para pasar a HTTPS después.

Yo elegiría **3**.

## Usuario

1

## Asistente

Perfecto.

**Decisión 8 cerrada:** la conexión será mediante **HTTP en red local + token de autenticación**. Para el MVP priorizamos simplicidad y funcionamiento estable dentro de casa.

### 9. ¿Cuánto tiempo quieres que sea válido el QR para añadir/reconectar un dispositivo?

**1)** Hasta que se use una vez.  
**2)** 2 minutos.  
**3)** 5 minutos.  
**4)** Mientras esté visible en pantalla, y se invalida al cerrarlo o usarlo.

Yo elegiría **4**, porque encaja muy bien con tu idea: muestras el QR cuando quieres vincular/reconectar y deja de servir al salir de esa pantalla.

## Usuario

4

## Asistente

Perfecto.

**Decisión 9 cerrada:** el QR será válido **solo mientras esté visible en la tablet**. En cuanto se cierre esa pantalla o se use correctamente, quedará invalidado.

### 10. ¿Qué quieres que ocurra si el móvil intenta conectarse pero la tablet ha cambiado de IP dentro de la Wi-Fi?

**1)** Que haya que volver a escanear el QR.  
**2)** Que el móvil intente localizar automáticamente la tablet en la red local.  
**3)** Que usemos un nombre local fijo tipo `pablotablet.local` para no depender de la IP.  
**4)** Combinar 2 y 3, dejando el QR solo para emparejar o recuperar acceso.

Yo elegiría **4**.

## Usuario

4

## Asistente

Perfecto.

**Decisión 10 cerrada:** el móvil intentará localizar la tablet automáticamente en la red local y, además, tendrá un nombre local estable tipo **`pablotablet.local`**. El QR seguirá reservado para **añadir dispositivos o recuperar la conexión**.

### 11. ¿Qué quieres que pase si varios móviles cambian algo a la vez?

**1)** Gana el último cambio recibido.  
**2)** Bloquear temporalmente la edición mientras otro dispositivo está modificando algo.  
**3)** Detectar conflictos y preguntar cuál conservar.  
**4)** Algo más avanzado por módulo.

Para el MVP elegiría **1**.

## Usuario

3. Dime cuántas quedan

## Asistente

**Decisión 11 cerrada:** si dos dispositivos modifican lo mismo a la vez, se detectará el conflicto y se preguntará qué versión conservar.

Nos quedan **9 decisiones** para dejar esta parte suficientemente definida y poder empezar sin agujeros importantes.

### 12. Tras aceptar un dispositivo mediante QR, ¿cuánto debería durar su acceso?

**1)** Para siempre, hasta que se revoque manualmente.  
**2)** Caduca cada 30 días.  
**3)** Caduca cada 6 meses.  
**4)** Sesión larga que se renueva automáticamente mientras el dispositivo siga autorizado.

Yo elegiría **4**.

## Usuario

4

## Asistente

Perfecto.

**Decisión 12 cerrada:** la sesión será **larga y se renovará automáticamente** mientras el dispositivo siga autorizado. Solo perderá acceso si se revoca, se borra la sesión o hay un problema que obligue a reemparejarlo.

Quedan **8 decisiones**.

### 13. ¿Cómo quieres que se actualicen los cambios entre móvil y tablet?

**1)** Solo al guardar y recargar manualmente.  
**2)** Actualización automática cada pocos segundos.  
**3)** Tiempo real mediante WebSocket/SSE: cambias algo en el móvil y la tablet lo refleja al instante.

Yo elegiría **3**.

## Usuario

3

## Asistente

Perfecto.

**Decisión 13 cerrada:** los cambios entre móvil y tablet se sincronizarán **en tiempo real**, usando WebSocket o SSE según encaje mejor en la implementación.

Quedan **7 decisiones**.

### 14. ¿Dónde quieres guardar los datos principales de la tablet?

**1)** Archivos JSON sencillos.  
**2)** SQLite directamente.  
**3)** Room sobre SQLite si finalmente usamos app Android nativa.  
**4)** Elegir según la arquitectura final de la tablet: SQLite como base y Room solo si es Android nativo.

Yo elegiría **4**.

## Usuario

4

## Asistente

Perfecto.

**Decisión 14 cerrada:** usaremos **SQLite como base local**. Si la tablet termina siendo app Android nativa, la capa de acceso será **Room**; si no, mantendremos SQLite directamente.

Quedan **6 decisiones**.

### 15. ¿Qué debe pasar si la tablet se queda sin Internet?

**1)** Solo funciona la interfaz, pero los módulos online muestran error.  
**2)** Todo lo posible sigue funcionando con datos locales y los módulos online muestran el último dato disponible + aviso de desconexión.  
**3)** Intentar ocultar por completo la pérdida de Internet y seguir mostrando datos antiguos sin avisar.

Yo elegiría **2**.

## Usuario

2

## Asistente

Perfecto.

**Decisión 15 cerrada:** si la tablet pierde Internet, todo lo local seguirá funcionando. Los módulos que dependan de servicios externos mostrarán **el último dato disponible** y un **aviso de que está desactualizado o sin conexión**.

Quedan **5 decisiones**.

### 16. ¿Qué debería incluir una copia de seguridad completa?

**1)** Configuración + notas + widgets + datos locales.  
**2)** Lo anterior + fotos/archivos almacenados en la tablet.  
**3)** Todo lo anterior + sesiones/dispositivos vinculados.  
**4)** Todo excepto credenciales sensibles y sesiones de dispositivos.

Yo elegiría **4**.

## Usuario

4

## Asistente

Perfecto.

**Decisión 16 cerrada:** la copia de seguridad incluirá **configuración, notas, widgets, datos locales y archivos/fotos**, pero **no** credenciales sensibles ni sesiones de dispositivos vinculados.

Quedan **4 decisiones**.

### 17. ¿Cómo quieres gestionar las copias automáticas?

**1)** Solo una copia automática que se va sobrescribiendo.  
**2)** Mantener varias copias históricas con fecha.  
**3)** Mantener las últimas X copias y borrar las más antiguas automáticamente.  
**4)** Copias automáticas + posibilidad de marcar algunas para no borrarlas.

Yo elegiría **3**.

## Usuario

3

## Asistente

Perfecto.

**Decisión 17 cerrada:** las copias automáticas se guardarán con historial y el sistema mantendrá solo **las últimas X**, eliminando automáticamente las más antiguas.

Quedan **3 decisiones**.

### 18. ¿Con qué frecuencia quieres crear esas copias automáticas?

**1)** Cada día.  
**2)** Cada semana.  
**3)** Cada vez que haya cambios importantes + una diaria de seguridad.  
**4)** Frecuencia configurable por el usuario.

Yo elegiría **4**.

## Usuario

4

## Asistente

Perfecto.

**Decisión 18 cerrada:** la frecuencia de las copias automáticas será **configurable por el usuario**.

Quedan **2 decisiones**.

### 19. ¿Qué quieres que ocurra al restaurar una copia de seguridad?

**1)** Sustituir completamente el estado actual por el de la copia.  
**2)** Intentar fusionar la copia con los datos actuales.  
**3)** Preguntar antes de restaurar y permitir elegir entre reemplazar todo o fusionar.

Yo elegiría **1** para el MVP, porque es mucho más predecible y evita conflictos raros.

## Usuario

1

## Asistente

Perfecto.

**Decisión 19 cerrada:** restaurar una copia sustituirá **completamente** el estado actual por el contenido de esa copia. Antes de hacerlo habrá confirmación y pedirá el PIN sensible que definimos antes.

Queda **1 decisión**.

### 20. Si alguien intenta acceder a la web local sin estar vinculado, ¿qué quieres que vea?

**1)** Una pantalla bloqueada indicando que el dispositivo no está autorizado.  
**2)** Una pantalla bloqueada + opción de iniciar el proceso de vinculación desde ese mismo móvil.  
**3)** No mostrar prácticamente nada, solo error de acceso.  
**4)** Pantalla bloqueada con nombre de la tablet y estado básico, pero sin ningún dato privado.

Yo elegiría **2**.

## Usuario

1

## Asistente

Perfecto.

**Decisión 20 cerrada:** si un dispositivo no está vinculado, verá únicamente una **pantalla bloqueada indicando que no está autorizado**. No podrá iniciar el emparejamiento desde ahí ni acceder a información privada.

Con esto, **ya tenemos esta parte funcionalmente definida y lista para empezar**: arquitectura local, descubrimiento, QR, emparejamiento, sesiones, permisos, seguridad, sincronización, conflictos, almacenamiento y copias de seguridad.
