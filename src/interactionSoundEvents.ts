/**
 * Reproduce el sonido propio de Pablo Tablet únicamente en botones.
 * Los selectores HTML delegan en el menú nativo de Android, que puede emitir
 * su propio clic al abrirse y al confirmar una opción.
 */
export function shouldPlayInteractionSoundOnClick(target: EventTarget | null): boolean {
  if (!(target instanceof Element)) return false
  return target.closest('button') !== null && target.closest('.settings-range-row') === null
}
