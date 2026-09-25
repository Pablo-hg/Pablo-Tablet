# Pablo Tablet

Aplicación doméstica para Android diseñada como interfaz principal de una tablet. El proyecto combina un dashboard configurable con páginas a pantalla completa para reloj, tiempo, notas y los futuros módulos del hogar.

## Estado actual

- React, TypeScript, Vite y Capacitor para Android.
- Interfaz horizontal adaptada a tablet y preparada para ejecutarse a pantalla completa.
- Dashboard principal con reloj, tiempo, notas y zona de próximos eventos.
- Motor de páginas con indicadores, cambio manual y rotación automática configurable.
- Deslizamiento horizontal sobre el fondo, sin interferir con botones, campos o widgets interactivos.
- Navegación inferior contextual que se oculta automáticamente.
- Ajustes para activar páginas, pausar la rotación y cambiar sus intervalos.
- Datos persistentes en el almacenamiento local, incluyendo migración desde versiones anteriores.

## Módulos implementados

### Notas

- Varias notas con título y contenido.
- Colores, fijado y archivado.
- Restauración y eliminación.
- Nota destacada en el dashboard.

### Reloj, alarmas y temporizadores

- Reloj y fecha a pantalla completa.
- Alarmas locales editables, activables y eliminables.
- Varios temporizadores con inicio, pausa, reinicio y eliminación.
- Persistencia de alarmas y temporizadores tras recargar la aplicación.
- Próxima alarma o temporizador activo visible desde el dashboard.

### Tiempo

- Primera vista visual a pantalla completa.
- Estado actual, previsión por horas y previsión de varios días con datos de demostración.
- Acceso desde el dashboard e inclusión en el slider y en la configuración de páginas.

## Desarrollo

```bash
npm install
npm run dev
```

Comprobaciones antes de integrar cambios:

```bash
npm run lint
npm run build
```

## Android

```bash
npm run android:sync
npm run android:open
```

La aplicación web se compila en `dist/`, que Capacitor empaqueta en Android. La activación final del modo kiosco o launcher, los avisos con sonido y las notificaciones con la pantalla bloqueada requieren todavía trabajo nativo y permisos del dispositivo.

## Pendiente planificado

- Desarrollo en profundidad de la vista del tiempo: API meteorológica real, varias ciudades, ubicación predeterminada, actualización de datos y estados de carga, error y falta de conexión.
- Notificaciones y recordatorios nativos de Android para alarmas, temporizadores y notas.
- Calendario local y posterior integración con Google Calendar.
- Galería, salvapantallas, administración desde móvil, emparejamiento y copias de seguridad.

## Contexto del proyecto

Las conversaciones exportadas del proyecto de ChatGPT **Pablo Tablet** y el chat compartido de Codex están indexados en [`chats/README.md`](chats/README.md).
