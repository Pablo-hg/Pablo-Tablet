import { describe, expect, it } from 'vitest'
import { shouldPlayInteractionSoundOnClick } from '../interactionSoundEvents'

describe('sonidos táctiles de los controles', () => {
  it('reproduce un solo sonido propio en botones normales y sus iconos', () => {
    const button = document.createElement('button')
    const icon = document.createElement('span')
    button.appendChild(icon)
    expect(shouldPlayInteractionSoundOnClick(button)).toBe(true)
    expect(shouldPlayInteractionSoundOnClick(icon)).toBe(true)
  })

  it('no añade un clic al abrir un selector ni al elegir una opción nativa', () => {
    const select = document.createElement('select')
    const option = document.createElement('option')
    select.appendChild(option)
    expect(shouldPlayInteractionSoundOnClick(select)).toBe(false)
    expect(shouldPlayInteractionSoundOnClick(option)).toBe(false)
  })

  it('sigue ignorando las acciones de un control de volumen', () => {
    const range = document.createElement('div')
    range.className = 'settings-range-row'
    const button = document.createElement('button')
    range.appendChild(button)
    expect(shouldPlayInteractionSoundOnClick(button)).toBe(false)
  })

  it('ignora los campos de texto y eventos sin un elemento del DOM', () => {
    expect(shouldPlayInteractionSoundOnClick(document.createElement('input'))).toBe(false)
    expect(shouldPlayInteractionSoundOnClick(null)).toBe(false)
    expect(shouldPlayInteractionSoundOnClick(new EventTarget())).toBe(false)
  })
})
