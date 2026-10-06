# Instrucciones de Pablo Tablet

- Lee `FLUJO-DE-RAMAS-Y-VERSIONES.md` antes de proponer cambios.
- La rama de integración es `dev`; `main` representa únicamente código estable y publicable.
- El trabajo normal parte de `dev` en una rama `feature/<issue>-<descripcion>` o `fix/<issue>-<descripcion>`.
- Los pull requests de trabajo apuntan a `dev` y usan `Refs #<numero>`. No uses `Fixes` ni `Closes` antes de una publicación correcta.
- No hagas push directo a `dev` o `main`, no crees tags ni Releases y no cambies etiquetas de estado de los Issues.
- La versión aprobada para esta rama de publicación es `0.2.0`.
- Antes de entregar código ejecuta `npm run lint`, `npm test`, `npm run build` y `npx cap sync android`.
- Para cambios Android, compila también el APK correspondiente cuando el entorno lo permita.
- No afirmes que una función está validada en la Teclast T65 si no existe una prueba física realizada por una persona.
- No introduzcas tokens, contraseñas, claves de firma ni otras credenciales en código, commits, logs o pull requests.
- Conserva la cuadrícula del dashboard, el almacenamiento local de la tablet y la compatibilidad de la administración móvil salvo que el Issue pida expresamente modificarlos.
- Limita cada pull request al Issue asignado y documenta las comprobaciones ejecutadas y las que queden pendientes.
