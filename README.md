# Pablo Tablet

MVP 0.1 de una experiencia de hogar para Android: una interfaz de tablet a pantalla completa, pensada para operar como la capa visual principal del dispositivo.

## Incluido en esta primera base

- React, TypeScript y Vite.
- Tailwind CSS preparado para las próximas pantallas.
- Capacitor configurado para Android.
- Shell visual adaptado a tablet, con un dashboard inicial.
- Navegación inferior que permanece oculta hasta tocar la pantalla.
- Pantalla de ajustes de base y componentes listos para crecer como widgets.

## Desarrollo

```bash
npm install
npm run dev
```

## Android

```bash
npm run build
npx cap sync android
npx cap open android
```

La app web está estructurada para compilarse en `dist/`, que Capacitor empaqueta en Android. La activación final del modo kiosco/launcher requiere configuración nativa y permisos del dispositivo; esta base deja el contenedor preparado para incorporarla.

## Contexto del proyecto

Las conversaciones exportadas del proyecto de ChatGPT **Pablo Tablet** y el chat compartido de Codex están indexados en [`chats/README.md`](chats/README.md).
