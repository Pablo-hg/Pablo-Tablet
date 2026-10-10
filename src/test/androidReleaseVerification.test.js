import { describe, expect, it } from 'vitest'
import {
  parseBadging,
  parseCertificateSha256,
  validateCertificate,
  validateIdentity,
} from '../../scripts/verify-android-release.mjs'

describe('verificacion de una release Android', () => {
  it('extrae la identidad del APK', () => {
    expect(
      parseBadging(
        "package: name='com.pablohorcajada.tablet' versionCode='1002' versionName='0.2.1' platformBuildVersionName='16'",
      ),
    ).toEqual({
      packageName: 'com.pablohorcajada.tablet',
      versionCode: '1002',
      versionName: '0.2.1',
    })
  })

  it('normaliza la huella SHA-256 del certificado', () => {
    expect(
      parseCertificateSha256('Signer #1 certificate SHA-256 digest: AA:0b:C1'),
    ).toBe('aa0bc1')
  })

  it('rechaza una clave distinta de la firma oficial', () => {
    expect(() => validateCertificate('aabbcc', '001122')).toThrow(
      'Certificado de firma inesperado',
    )
  })

  it('rechaza un paquete o version distintos de los esperados', () => {
    expect(() =>
      validateIdentity(
        { packageName: 'otro.paquete', versionCode: '1002', versionName: '0.2.1' },
        { packageName: 'com.pablohorcajada.tablet', versionName: '0.2.1', minimumVersionCode: 1003 },
      ),
    ).toThrow('Paquete inesperado')

    expect(() =>
      validateIdentity(
        { packageName: 'com.pablohorcajada.tablet', versionCode: '1002', versionName: '0.2.0' },
        { packageName: 'com.pablohorcajada.tablet', versionName: '0.2.1', minimumVersionCode: 1003 },
      ),
    ).toThrow('Version inesperada')
  })

  it('rechaza un versionCode invalido', () => {
    expect(() =>
      validateIdentity(
        { packageName: 'com.pablohorcajada.tablet', versionCode: '0', versionName: '0.2.1' },
        { packageName: 'com.pablohorcajada.tablet', versionName: '0.2.1', minimumVersionCode: 1003 },
      ),
    ).toThrow('versionCode invalido')
  })

  it('rechaza un versionCode que no pueda actualizar la version instalada', () => {
    expect(() =>
      validateIdentity(
        { packageName: 'com.pablohorcajada.tablet', versionCode: '1002', versionName: '0.2.2' },
        { packageName: 'com.pablohorcajada.tablet', versionName: '0.2.2', minimumVersionCode: 1003 },
      ),
    ).toThrow('versionCode demasiado bajo')
  })
})
