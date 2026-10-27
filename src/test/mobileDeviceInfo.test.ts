import { describe, expect, it } from 'vitest'
import { mobileDeviceInfo } from '../mobileDeviceInfo'

describe('readable mobile device details', () => {
  it('does not mistake a reduced Android user agent for an actual model or OS version', () => {
    const info = mobileDeviceInfo('Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 Chrome/155.0.0.0 Mobile Safari/537.36')
    expect(info).toEqual({ browser: 'Chrome 155', device: 'Móvil Android', platform: 'Android' })
  })
  it('recognises browsers that also include Chrome in their user agent', () => {
    expect(mobileDeviceInfo('Android Chrome/155.0 Mobile EdgA/155.0').browser).toBe('Edge 155')
    expect(mobileDeviceInfo('Android Chrome/155.0 Mobile SamsungBrowser/30.0').browser).toBe('Samsung Internet 30')
  })
})
