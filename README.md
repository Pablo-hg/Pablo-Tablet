# Pablo Tablet

Pablo Tablet es un panel doméstico para una **Teclast T65**. La tablet es el dispositivo central y funciona de forma autónoma; los móviles se usarán para administrar el panel desde la misma red local. El objetivo del MVP es un panel útil sin depender de Internet: dashboard, notas, reloj, alarmas, calendario local, fotos y salvapantallas.

Este README concentra el estado técnico y funcional del proyecto. Las decisiones detalladas vigentes están en la [especificación funcional](ESPECIFICACION-FUNCIONAL.md) y en la [arquitectura tablet-móvil](chats/08-arquitectura-tecnica.md). Las conversaciones originales se conservan como referencia en el [índice de chats](chats/INDICE-CHATS.md).

## Principios ya decididos

- La tablet es la fuente de verdad: sus datos y funciones locales siguen disponibles sin Wi-Fi ni Internet.
- El editor del móvil será una web local instalable como PWA, no una app móvil nativa.
- El acceso remoto desde Internet no forma parte de la V1.
- Los móviles se vincularán con un QR temporal y una confirmación física en la tablet. El QR caduca al usarse, al cerrar su pantalla o a los 5 minutos, lo que ocurra primero. Una vez autorizados, conservarán una credencial revocable.
- La dirección principal será `pablotablet.local`, con la IP local como alternativa.
- El panel usa una cuadrícula adaptable de tres columnas. Los widgets normales viven en Inicio; los fullscreen se muestran como páginas adicionales y pueden rotar automáticamente.
- La interfaz admite horizontal y vertical, con layouts independientes; paisaje es la orientación principal. Usa Material You, tarjetas grandes y legibilidad a distancia. La navegación se oculta hasta interactuar.
- La arquitectura final será híbrida: React dentro de Capacitor y un servicio nativo Android para el servidor local, autoarranque y recuperación. La persistencia definitiva será Room sobre SQLite. La versión actual usa almacenamiento local del navegador como base del prototipo.

## Estado actual

| Área | Estado | Disponible hoy |
| --- | --- | --- |
| Base web | Implementado | React, TypeScript, Vite, Tailwind y compilación para `dist/`. |
| Android | Implementado, por validar en dispositivo | Capacitor, orientación horizontal, modo inmersivo y permiso de alarmas exactas. |
| Dashboard y navegación | Parcial | Panel, barra contextual, gesto horizontal, páginas Inicio/Reloj/Notas y rotación configurable. El Inicio usa un motor de widgets con grid persistente de tres columnas y layouts independientes en horizontal/vertical. |
| Notas y recordatorios | Parcial | Crear, editar, colorear, fijar, archivar, restaurar y eliminar notas; recordatorios persistentes y avisos simulados. |
| Alarmas y temporizadores | Parcial | Alarmas diarias y varios temporizadores persistentes, con iniciar, pausar y reiniciar. |
| Notificaciones Android | Preparado | Integración con `@capacitor/local-notifications` para recordatorios y alarmas; falta probar permisos y entrega real en la tablet. |
| Administración móvil, QR y servidor local | Pendiente | Aún no hay API, PWA de administración, mDNS ni emparejamiento. |
| Calendario, tiempo, fotos, salvapantallas y copias | Pendiente | Solo hay elementos visuales o de planificación; no existen módulos funcionales. |

La web guarda ahora notas, alarmas, temporizadores, preferencias y layouts de widgets en `localStorage`. No debe considerarse todavía el almacenamiento definitivo ni un sistema de copias de seguridad.

## Fases del MVP

| Fase | Alcance | Situación |
| --- | --- | --- |
| 0. Base técnica | Proyecto web, Android, diseño base, navegación, datos simulados y configuración. | En marcha: base web y Android creados; faltan modelo definitivo, SQLite y pruebas en dispositivo. |
| 1. Dashboard y widgets | Cuadrícula configurable, reloj, fecha, próximo elemento y meteorología inicial. | Parcial: shell, reloj/fecha, páginas, rotación y motor de layout funcionan; falta el editor móvil, widgets adicionales y datos reales. |
| 2. Notas y recordatorios | Notas, colores, fijado, archivo, recordatorios y su widget. | Parcial: flujo local y persistencia implementados; faltan formato enriquecido, estado completado/tachado y cierre de avisos Android. No habrá autoeliminación. |
| 3. Reloj, alarmas y temporizadores | Reloj, alarmas locales, múltiples temporizadores, persistencia y notificaciones. | Parcial: funciones locales listas en el prototipo; faltan sonidos, snooze, controles avanzados y validación nativa. |
| 4. Meteorología | API real, ciudades, previsión, caché y widget. | Pendiente. |
| 5. Calendario | Calendario local primero; vistas, eventos, recordatorios y widget. Google Calendar después, con caché y sincronización. | Pendiente. |
| 6. Fotos y salvapantallas | Galería local, álbumes, carrusel, inactividad y estados panel → salvapantallas → modo nocturno. | Pendiente. |
| 7. Administración desde móvil | Servidor en la tablet, editor web/PWA, QR, dispositivos autorizados y cambios en tiempo real. | Pendiente. |
| 8. Copias y recuperación | Exportación e importación, copias automáticas locales, rotación y restauración. | Pendiente. |
| 9. Seguridad y cierre | Tokens, revocación, validación, recuperación ante reinicios, logs, errores, consumo y pruebas prolongadas. | Pendiente. |

## Arquitectura acordada y trabajo técnico pendiente

- Servidor nativo Android en la tablet, API REST y WebSocket para sincronización en tiempo real. Quedan por implementar el puerto y la publicación de `pablotablet.local` mediante mDNS.
- Room sobre SQLite como persistencia definitiva. Quedan por implementar el esquema, las migraciones y los modelos.
- Fotografías originales en el almacenamiento privado de la aplicación y metadatos en Room.
- Copia completa semanal los domingos a las 03:00, conservando las tres últimas; no se copiarán credenciales ni sesiones.
- API del editor móvil para aplicar movimientos, redimensionados y visibilidad sobre el layout persistente; la normalización y recolocación segura del grid ya están implementadas en la web.
- HTTP local con tokens largos, aleatorios, individuales y revocables; queda por concretar su formato y custodia interna.
- Autoarranque, recuperación del proceso/servidor, batería y comportamiento de modo kiosco en Android.
- PWA del móvil, pruebas automatizadas, diagnóstico, actualizaciones y onboarding.

## Fuera del MVP inicial

Reconocimiento facial, control por voz avanzado, domótica completa, Spotify, asistentes de IA, sincronización cloud propia, Google Calendar, perfiles de dashboard, creación libre de temas y personalización ilimitada del layout.

## Desarrollo

```bash
npm install
npm run dev
npm run build
npm run lint
```

## Android

```bash
npm run android:sync
npm run android:open
```

`android:sync` compila la web y actualiza el proyecto Capacitor. La validación pendiente relevante es instalar y probar la aplicación en la Teclast T65: modo inmersivo, gesto, persistencia y notificaciones.

## Historial y contexto

Los acuerdos de producto, diseño y arquitectura se mantienen en el [índice de chats](chats/INDICE-CHATS.md). Son material de referencia; este README es la fuente resumida para el estado y las fases actuales.
