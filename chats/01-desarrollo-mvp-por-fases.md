# Desarrollo del MVP por fases

> **Documento histórico.** Conserva la conversación original y puede contener decisiones sustituidas. Para los acuerdos vigentes, consulta [la especificación funcional](../ESPECIFICACION-FUNCIONAL.md) y [el README](../README.md).

- Proyecto de origen: ChatGPT / Pablo Tablet
- ID de conversación: `6aaa7267-7940-83ed-9412-6bd6386fa6d9`
- Creado: 2026-09-16T10:41:44.872Z
- Actualizado: 2026-09-16T14:21:04.026Z

---

## Usuario

Desarrollo del MVP por fases

## Asistente

Para **Pablo Tablet**, yo desarrollaría el MVP de forma incremental, procurando que al terminar cada fase haya algo funcional que podamos probar en el emulador. Evitaría empezar a la vez con Google Calendar, fotos, QR, backups y demás porque complicaría muchísimo detectar problemas.

### Fases del MVP

1. **Fase 0 — Base técnica**
   - Crear proyecto y estructura.
   - Definir modelo de datos y almacenamiento local.
   - Sistema de configuración.
   - Navegación principal.
   - Preparar diseño responsive para formato tablet 11".
   - Modo desarrollo con datos simulados.
   - Tema claro/oscuro y variables globales de diseño.

   **Resultado:** aplicación vacía pero con una arquitectura sólida sobre la que construir todo lo demás.

2. **Fase 1 — Dashboard principal**
   - Pantalla principal modular.
   - Sistema de widgets.
   - Posibilidad de activar/desactivar widgets.
   - Layout inicial configurable.
   - Reloj digital.
   - Fecha completa.
   - Próximo evento/recordatorio simulado.
   - Widget meteorológico inicialmente con datos mock.

   **Resultado:** ya tenemos el aspecto real que tendrá la tablet durante el día.

3. **Fase 2 — Notas y recordatorios**
   - Crear, editar y eliminar notas.
   - Título + contenido.
   - Colores.
   - Fijar notas.
   - Fecha/hora de recordatorio.
   - Archivado.
   - Eliminación automática opcional.
   - Formato enriquecido básico.
   - Widget de notas en el dashboard.

   Aquí metería también el sistema central de **notificaciones y recordatorios**, porque después lo reutilizarán calendario, alarmas y otros módulos.

   **Resultado:** primera función realmente útil para uso doméstico diario.

4. **Fase 3 — Reloj, alarmas y temporizadores**
   - Reloj digital/analógico.
   - Alarmas locales.
   - Varios temporizadores simultáneos.
   - Persistencia tras reiniciar la aplicación.
   - Notificaciones.
   - Próximo temporizador/alarma visible desde el dashboard.

   **Resultado:** la tablet ya puede sustituir parcialmente a un reloj/Google Nest doméstico.

5. **Fase 4 — Tiempo meteorológico**
   - API meteorológica real.
   - Varias ciudades guardadas.
   - Cambio manual entre ciudades.
   - Ubicación predeterminada.
   - Estado actual.
   - Temperatura.
   - Previsión básica.
   - Widget para dashboard.

   **Resultado:** eliminamos uno de los últimos datos simulados del panel principal.

6. **Fase 5 — Calendario**
   Primero haría un calendario **local**:
   - Vista día/semana/mes.
   - Crear eventos.
   - Editar/eliminar eventos.
   - Próximo evento en dashboard.
   - Recordatorios.

   Después añadiría:
   - Google Calendar.
   - Selección de calendarios.
   - Sincronización.
   - Gestión de autenticación.

   **Resultado:** calendario completamente utilizable incluso si Google no está configurado.

7. **Fase 6 — Fotos y salvapantallas**
   - Galería local.
   - Selección de álbumes/fotos.
   - Carrusel.
   - Salvapantallas después de X minutos.
   - Reloj/fecha sobre las imágenes.
   - Transiciones.
   - Configuración del tiempo de inactividad.

   También implementaríamos los tres estados que definimos:
   **panel normal → salvapantallas → modo nocturno muy oscuro**.

   **Resultado:** comportamiento real de la tablet cuando está permanentemente colocada en casa.

8. **Fase 7 — Administración desde móvil**
   Esta es una de las partes más importantes, pero conviene hacerla cuando lo anterior ya funciona.
   - Servidor local de configuración.
   - Página web accesible desde móvil.
   - QR mostrado por la tablet.
   - Emparejamiento móvil ↔ tablet.
   - Configuración de widgets.
   - Gestión de notas.
   - Gestión de calendario.
   - Fotos.
   - Ciudades.
   - Alarmas.
   - Ajustes generales.

   **Resultado:** prácticamente no hace falta tocar la tablet para configurarla.

9. **Fase 8 — Backups y recuperación**
   - Exportar configuración completa.
   - Descargar backup desde el móvil.
   - Importar backup.
   - Copias automáticas locales.
   - Rotación de copias antiguas.
   - Restauración completa.

   **Resultado:** podemos reinstalar la aplicación o cambiar de dispositivo sin perder la configuración.

10. **Fase 9 — Seguridad y cierre del MVP**
    - Revisar acceso desde la red local.
    - Tokens de sesión.
    - Caducidad del emparejamiento QR.
    - Protección de credenciales de Google/APIs.
    - Validación de entradas.
    - Manejo de tablet sin Internet.
    - Recuperación después de reinicio.
    - Logs.
    - Pantallas de error.
    - Pruebas de uso continuado.
    - Optimización de consumo.

    **Resultado:** **MVP v1.0 listo para instalar en una tablet física**.

### Lo que dejaría fuera del MVP

No intentaría meter inicialmente reconocimiento facial, control por voz avanzado, integración domótica completa, Spotify, asistentes IA, múltiples usuarios complejos, sincronización cloud propia o personalización absoluta del layout.

Primero conseguiría esto:

**Dashboard + notas + reloj + alarmas + tiempo + calendario + fotos + salvapantallas + configuración desde móvil + backups.**

Ese conjunto ya convierte **Pablo Tablet** en un producto doméstico completo y, además, nos deja una arquitectura sobre la que añadir después módulos sin rehacer la aplicación.

Para empezar a programar, el siguiente paso lógico sería concretar la **Fase 0**: stack, estructura de carpetas, frontend, backend local, base de datos y cómo vamos a ejecutar la primera versión en el emulador.

## Usuario

https://chatgpt.com/share/6aaa728f-ba28-83eb-a0b7-aff3359efef7 
Usa esta conversación únicamente como contexto del proyecto **Pablo Tablet**. No hagas nada todavía, no desarrolles código ni tomes nuevas decisiones. Limítate a confirmar que has entendido el contexto y espera mis siguientes instrucciones.

## Asistente

Entendido. Usaré esa conversación únicamente como contexto del proyecto **Pablo Tablet**, sin desarrollar código, modificar nada ni tomar nuevas decisiones por ahora.

Quedo a la espera de tus siguientes instrucciones.

## Usuario

Esto incluye desarrollar el mvp o es definir cosas?

## Asistente

Incluye **desarrollar el MVP**, no solo definirlo.

Lo que te propuse antes era una **hoja de ruta de implementación**:

- La **Fase 0** tiene bastante de definición técnica: stack, arquitectura, estructura del proyecto, almacenamiento, etc.
- Desde la **Fase 1 en adelante** ya hablamos de **programar funcionalidades reales**: dashboard, widgets, notas, reloj, tiempo, calendario, salvapantallas, configuración desde móvil, etc.
- Las últimas fases son de **integración, seguridad, pruebas y cierre del MVP**.

O sea, no sería estar semanas “definiendo cosas” antes de empezar. La idea sería:

**definir lo mínimo necesario → programarlo → probarlo → pasar a la siguiente fase.**

Y como ya hemos cerrado bastantes decisiones en los otros chats de **Pablo Tablet**, incluso podríamos recortar bastante la parte de definición previa.

## Usuario

Definimos lo falta tes entonces y luego empezamos con la chica

## Asistente

Sí. Primero cerramos **solo lo que falte por definir del MVP**, y en cuanto quede eso claro empezamos con la **chicha: desarrollo real**.

Ahora mismo yo dejaría pendientes únicamente estos bloques antes de tocar código:

- **Stack definitivo**: qué usamos para la tablet/web, backend local y almacenamiento.
- **Estructura de la app**: cómo se separan dashboard, widgets, configuración, servicios y datos.
- **Persistencia local**: qué datos guarda la tablet y en qué formato/BD.
- **Comunicación móvil ↔ tablet**: ya sabemos el concepto del QR y confirmación, pero falta concretar técnicamente cómo se conectan.
- **Sistema de widgets**: modelo común para tamaño, posición, fullscreen, páginas y rotación.
- **Estado sin conexión**: qué sigue funcionando y qué módulos dependen de Internet.
- **Arranque y modo kiosco/pantalla completa**: cómo hacemos que parezca un dispositivo dedicado y no una app encima de Android.
- **Orden exacto del primer desarrollo**: qué entra en la primera versión ejecutable.

Cuando cerremos esos puntos, **dejamos de definir y empezamos a programar el MVP por fases**.

Y yo empezaría por el **stack definitivo**, porque condiciona prácticamente todo lo demás.

## Usuario

En los otros tres chats ya hemos definido tres cosas. ¿Qué es lo que falta aquí para definir? ¿Empezamos con ello? ¿Me quieres preguntar cosas o le damos ya por...

## Asistente

Sí: con lo que ya hemos cerrado en los otros tres chats, yo **no abriría otra ronda larga de preguntas**.

Ahora mismo ya tenemos cubiertos tres pilares:

- **Requisitos funcionales** → qué debe hacer Pablo Tablet.
- **Interfaz y sistema de widgets** → cómo se comporta el dashboard, fullscreen, páginas, rotación, barra inferior, etc.
- **Arquitectura/local y emparejamiento** → cómo funciona tablet ↔ web/móvil, QR, confirmación, funcionamiento local, desconexiones, etc.

Así que en este chat lo que falta no es tanto «definir el producto», sino **convertir todo eso en un orden de desarrollo**.

Yo daría la definición del MVP por suficientemente cerrada y establecería simplemente esta secuencia:

1. **Base del proyecto**
   Estructura, ejecución en emulador, almacenamiento local, configuración básica y servicios comunes.

2. **Shell de la tablet**
   Pantalla completa, navegación mínima, barra inferior oculta/visible y comportamiento general de la aplicación.

3. **Motor del dashboard**
   Páginas, grid de widgets, widgets normales/fullscreen y sistema de rotación.

4. **Primeros widgets reales**
   Empezar por los más sencillos para validar toda la arquitectura, por ejemplo reloj/fecha y notas.

5. **Persistencia**
   Que cambios, widgets y configuración sobrevivan al reinicio.

6. **Panel web de administración**
   Poder configurar la tablet desde otro dispositivo de la red.

7. **Emparejamiento QR**
   Mostrar QR → abrir desde móvil → petición → confirmación en tablet → dispositivo autorizado.

8. **Completar módulos que formen parte del MVP**
   Ir añadiéndolos sobre la arquitectura ya validada.

9. **Offline, errores y recuperación**
   Reinicios, pérdida de Internet, pérdida de conexión con el móvil, estados vacíos, etc.

10. **Pulido del MVP**
    Responsive para la tablet real, rendimiento, modo dedicado/kiosco y pruebas.

Y **calendario/Google y galería/salvapantallas los desarrollaría después de tener este núcleo funcionando**, tal y como comentábamos, porque no deberían bloquear la validación de la arquitectura principal.

Por tanto, por mi parte: **no te preguntaría nada más ahora mismo. Podemos dar esta parte por definida y pasar ya al desarrollo del MVP empezando por la Fase 1/base del proyecto.**

## Usuario

Vale, ¿qué dirías que es mejor visualmente? ¿Una aplicación nativa o una web? La cosa es, repito, que la tablet donde voy a instalar esto, donde se va a usar, olvídate de todo uso normal de una tablet, sino que esto va a ser como que simulase un sistema operativo. Entonces la cosa es, como se pondría como una especie de capa por encima del sistema operativo, entonces no sé qué es mejor, si una web o una aplicación.

## Asistente

Para tu caso, **no elegiría una web pura**.

Lo que mejor encaja es una **aplicación Android nativa como contenedor**, pero con la interfaz hecha con tecnologías web, por ejemplo:

**React + TypeScript + Capacitor → APK Android**

Visualmente puedes hacer que parezca exactamente un “sistema operativo” propio: pantalla completa, dashboard, widgets, animaciones, páginas, barra inferior propia, salvapantallas, etc. La diferencia importante no está tanto en el aspecto como en el **control que tienes sobre la tablet**.

Con una web abierta en Chrome tendríamos problemas más molestos: barra del navegador, gestos, posibilidad de salir fácilmente, arranque tras reinicio, control de pantalla, permisos, almacenamiento, modo kiosco, orientación, etc.

Con una APK podemos hacer cosas como:

- arrancar automáticamente al encender la tablet;
- funcionar en **pantalla completa inmersiva**;
- ocultar las barras de Android;
- controlar cuándo se apaga/enciende la pantalla;
- manejar salvapantallas y modo nocturno;
- almacenar datos localmente;
- acceder a funciones nativas cuando las necesitemos;
- funcionar sin Internet;
- bloquear bastante el acceso al Android normal;
- incluso llegar a convertir Pablo Tablet en el **launcher/Home** de Android.

Y ese último punto es especialmente interesante para lo que quieres.

En Android una aplicación puede registrarse como **Launcher**. Entonces, en vez de ver:

> Android → iconos → abrir Pablo Tablet

la experiencia sería prácticamente:

> Encender tablet → Pablo Tablet

Al pulsar Home también volverías a Pablo Tablet.

### Lo que haría yo

No haría todo nativo con Kotlin/Compose porque para este proyecto nos complicaría innecesariamente el desarrollo de widgets, layouts y panel web.

Tampoco haría simplemente:

**Chrome → localhost → Pablo Tablet**

Haría esta arquitectura:

**Android**
→ aplicación Pablo Tablet  
→ contenedor nativo  
→ **React + TypeScript**  
→ interfaz completa del “SO”  
→ almacenamiento y servicios locales

La parte que tú ves seguiría siendo React, por lo que desarrollar el dashboard será muchísimo más cómodo.

Y cuando necesitemos algo específico de Android:

**React → Capacitor → Android**

Por ejemplo:

```text
┌──────────────────────────────────────────┐
│              PABLO TABLET                │
│                                          │
│   ┌─────────┐ ┌─────────┐ ┌─────────┐    │
│   │ Tiempo  │ │ Reloj   │ │ Notas   │    │
│   │         │ │         │ │         │    │
│   └─────────┘ └─────────┘ └─────────┘    │
│                                          │
│           Dashboard / páginas            │
│                                          │
│              ○ Inicio  ⚙                 │
└──────────────────────────────────────────┘
            ↓
       React + TypeScript
            ↓
          Capacitor
            ↓
          Android
```

### Y hay tres niveles posibles de “ocultar Android”

**Nivel 1 — MVP**

APK en modo fullscreen/immersive.

Android prácticamente no se ve, pero todavía se puede salir mediante determinados gestos o botones.

**Nivel 2 — Tablet dedicada**

Pablo Tablet configurado como **launcher predeterminado**.

Ya empieza a sentirse realmente como si Pablo Tablet fuese el propio sistema de la tablet.

**Nivel 3 — Kiosco real**

Android **Lock Task / Device Owner**.

Aquí podemos bloquear aún más el sistema: impedir salir de la app, restringir ajustes, navegación, barra de estado, etc.

Para una tablet que va a estar dedicada **exclusivamente a esto**, probablemente acabaríamos llegando al **nivel 2 o 3**.

Por eso, la decisión que yo cerraría para el proyecto sería:

> **Pablo Tablet será una aplicación Android híbrida: interfaz React + TypeScript empaquetada como APK mediante Capacitor, diseñada para ejecutarse en pantalla completa y evolucionar posteriormente a launcher/modo kiosco.**

Eso además nos deja seguir desarrollando prácticamente como una web durante el MVP, que es bastante más cómodo, **sin renunciar después al control de una aplicación Android**.

## Usuario

Okay. Entonces que hacemos ahora?

## Asistente

Ahora ya **dejaría de definir producto** y pasaría al desarrollo.

El siguiente paso sería arrancar la **Fase 0: base técnica del MVP**, dejando preparada una primera APK que abra Pablo Tablet a pantalla completa, aunque todavía esté prácticamente vacía.

Yo lo haría en este orden:

1. **Crear el proyecto**
   - React
   - TypeScript
   - Vite
   - Capacitor para Android
   - Tailwind para la interfaz

2. **Preparar Android**
   - Generar el proyecto Android.
   - Ejecutarlo en emulador.
   - Pantalla completa.
   - Orientación adecuada para tablet.
   - Ocultar al máximo la interfaz de Android.

3. **Crear el esqueleto de Pablo Tablet**
   ```text
   Pablo Tablet
   ├── Dashboard
   ├── Widgets
   ├── Navegación
   ├── Ajustes
   ├── Servicios
   ├── Almacenamiento
   └── Administración
   ```

4. **Crear el shell visual**
   
   Todavía sin módulos complejos, pero que ya veamos:

   ```text
   ┌──────────────────────────────────────┐
   │                                      │
   │                                      │
   │          DASHBOARD VACÍO             │
   │                                      │
   │                                      │
   │                                      │
   │             ⌂     ⚙                  │
   └──────────────────────────────────────┘
   ```

   Con la barra inferior comportándose como decidimos: normalmente oculta y apareciendo al interactuar.

5. **Meter el sistema de páginas/widgets**
   
   Antes incluso de hacer notas, tiempo, calendario, etc., hacemos que el dashboard pueda gestionar:

   - widgets normales;
   - widgets fullscreen;
   - varias páginas;
   - rotación automática;
   - tiempo de rotación configurable;
   - activación/desactivación.

6. **Crear dos widgets sencillos de prueba**
   
   Empezaría con:
   
   **Reloj + fecha** y **nota simple**.

   No porque sean necesariamente los módulos prioritarios, sino porque sirven para comprobar que todo el motor funciona.

Al terminar esto tendríamos el **primer hito importante**:

> Encender emulador → arrancar Pablo Tablet → interfaz fullscreen → dashboard → widgets → páginas → navegación propia.

Ahí ya empezaríamos a sentir que estamos construyendo el “SO” de la tablet y no simplemente diseñándolo.

### Así dividiría el desarrollo desde ahora

**MVP 0.1 — Core**
→ proyecto + Android + fullscreen + dashboard.

**MVP 0.2 — Motor de widgets**
→ grid + páginas + fullscreen + slider.

**MVP 0.3 — Persistencia**
→ configuración y widgets sobreviven al reinicio.

**MVP 0.4 — Administración web**
→ configurar la tablet desde otro dispositivo.

**MVP 0.5 — QR y emparejamiento**
→ móvil ↔ tablet.

**MVP 0.6+ — Módulos**
→ notas, reloj, tiempo, etc.

Y después **calendario/Google** y **galería/salvapantallas**, que ya tienen sus propios bloques de trabajo.

Así que, en mi opinión, **ya no falta ninguna decisión importante para empezar**. El siguiente paso es directamente crear **Pablo Tablet MVP 0.1**.

## Usuario

okay, perfecto, pasa esta carpeta a codex, conectate a gituhb [https://github.com/](https://github.com/) y crea un repo ahgi para el proyecto. localmente crea una carpeta dentro de /home/pablohorcajada/Escritorio/Otras  cosas. Luego empieza

## Asistente

He pasado la tarea a **Work/Codex** para que pueda trabajar con GitHub y con la carpeta local.

Le he indicado que:
- cree el repo del proyecto en GitHub;
- cree `/home/pablohorcajada/Escritorio/Otras cosas/...`;
- inicialice/clonе el proyecto allí;
- arranque el **MVP 0.1** con React + TypeScript + Vite + Tailwind + Capacitor;
- deje preparada la base Android/fullscreen;
- haga commits claros y deje el repo listo para seguir.

A partir de aquí, el desarrollo debe continuar en ese nuevo chat de Work/Codex.
