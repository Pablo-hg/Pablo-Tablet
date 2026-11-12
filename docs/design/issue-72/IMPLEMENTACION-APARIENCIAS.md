# Primera implementación de las diez apariencias

11/11/2026. Autorización de Pablo tras ver la comparativa: «me gusta los nuevos, ve implementadolos y te voy diciendo mi opion o eorres que haya que corregir». Se aprueba aplicar los diez conceptos a los componentes reales para revisión iterativa. Aclaración vigente: Playwright por tema en ambas orientaciones y revisión del usuario primero en web; no instalar en tablet hasta que Pablo lo pida expresamente. No se autoriza integración o publicación.

## Aplicado

- `themes.css` actualiza los diez perfiles con los colores, radios y familias locales de los conceptos aprobados. Conserva identificadores y orden de temas. Los tokens de texto secundario, acción/foco, controles, paneles y esquema nativo claro/oscuro se adaptan a cada perfil.
- `appearanceSystem.css` aplica las formas, tipografía y acabados a Inicio, Calendario, Reloj, Tiempo, Notas, Galería, Asistente y Ajustes, incluyendo componentes comunes y diálogos. Mantiene el marcado funcional y los controles existentes; no copia las omisiones de los bocetos ni reemplaza pantallas reales por SVG.
- Cálido y Retro usan relieve de papel; Retro añade esquinas asimétricas dentro de la misma caja. Cristal usa un fondo degradado, base opaca de lectura y reflejo superior, sin introducir blur costoso o animado. Original conserva la base azul mate. Nórdico combina paneles blancos, verde vivo y bloque horario oscuro; los roles locales de las alarmas y las agujas también se adaptan. Suizo usa geometría contenida y una marca azul interior. Mediterráneo incorpora un detalle de cerámica en la superficie. Monocromo usa serif editorial y contornos. Brutalista usa esquinas rectas, bordes y sombra desplazada; se retira el esquema anterior de módulos multicolor que no corresponde a la propuesta aprobada. AMOLED usa negro, cian y tipografía monoespaciada.
- Los títulos usan un rol tipográfico propio; las cifras conservan dígitos tabulares. El reloj digital sin resumen de alarmas adapta su tamaño al contenedor. No cambia el estilo analógico/digital seleccionado por el usuario.
- La capa B1 de Inicio deja de fijar una paleta local exclusiva de Original y adopta los tokens globales. Los eventos mantienen sus cuatro colores informativos, resaltado de hoy y resúmenes; Monocromo no elimina esas señales.
- Indicadores/tiradores de edición, selección y foco usan los roles del tema sin desplazar o escalar la caja. Los textos y las burbujas del asistente usan el color de lectura correspondiente al relleno, también con verde/amarillo claros.
- Ajustes conserva los mismos diez nombres, actualiza sus miniaturas y muestra los conceptos nuevos como descripción, con traducción ES/EN.

## Conservado

Cuadrícula, tamaños/posiciones y configuración por orientación; rutas y gestos; scroll de Ajustes y Reloj vertical; orden de herramientas; estilo de reloj elegido; datos, trazos y medios. No hay migración de preferencias, cambios de claves de almacenamiento, SQLite, API o servicios. No se descargan fuentes ni se añaden dependencias. Fotografías y trazos originales no se filtran ni reescriben para obtener el aspecto del tema.

## Comprobaciones

- **43 archivos / 255 pruebas web correctas**. Los dos nuevos escenarios ES/EN recorren los diez temas desde el selector real, comprueban selección única, persistencia al reabrir, conservación de layout/preferencias/estilo de reloj, trazos, alarmas y temporizadores. Son pruebas de comportamiento, no de geometría o colores renderizados.
- Build TypeScript/web correcto; persiste el aviso previo de bundle superior a 500 kB.
- Lint correcto con los cuatro avisos de refs previos de CalendarConnectionsPanel. `git diff --check` correcto.
- Los cuarenta pares opacos base de los perfiles coinciden con los del estudio y superan 4,5:1, mínimo 4,63:1. Los colores de foco sobre el panel base superan 3:1. No se presenta como contraste de todos los estados: reflejos, mezclas de eventos, superficies locales, controles desactivados y foco real requieren medición renderizada.
- Vite sirve los cambios en la web local; revisión mediante Ajustes → Apariencia. Las pruebas automatizadas usan almacenamiento aislado, no las preferencias reales del navegador del usuario.
- La conexión de Chrome falló; Pablo autorizó Playwright en navegador aislado. La [revisión real de Cálido](REVISION-TEMA-01-CALIDO.md) recoge 103 capturas finales entre el recorrido ES/EN, ventanas pequeñas y la corrección específica de galería. Se corrigieron contrastes heredados y miniaturas demasiado altas. No se repitió la suite de 255 pruebas.
- Tras adelantarse el agente con una instalación DEV, Pablo aclaró que quería verlo primero en web. Sus correcciones de asistente/calendario se aplican y validan solo en web (39 capturas adicionales); no se repite la instalación. La revisión enlazada recoge el estado actual y la evidencia histórica sin confundirlos.

## Pendiente

Pablo aprobó Cálido en web y pidió expresamente llevarlo a la tablet. Se compiló e instaló DEV con todos los últimos ajustes; apertura verificada, aceptación física pendiente. Revisar después los otros nueve temas uno por uno, empezando por AMOLED cuando Pablo confirme esta prueba. Futuras instalaciones requieren petición expresa. El navegador no sustituye gestos, teclado y rendimiento reales. Las hojas de propuesta continúan siendo referencias, no evidencias del producto renderizado.

La implementación está local y pendiente de revisión. La división de PRs debe separar perfiles/selector de los ajustes de componentes cuando se prepare la integración. No se ha fusionado, publicado ni cerrado #72.
