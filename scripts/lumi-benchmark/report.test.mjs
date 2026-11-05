import test from 'node:test'
import assert from 'node:assert/strict'
import { median, p95, wordErrorRate, summarize } from './report.mjs'

test('estadísticos: mediana y p95 por nearest-rank', () => {
  assert.equal(median([4, 1, 3, 2]), 2.5)
  assert.equal(p95(Array.from({ length: 10 }, (_, i) => i + 1)), 10)
  assert.equal(median([]), null)
  assert.equal(p95([]), null)
})

test('WER normaliza mayúsculas y signos, no inventa referencias', () => {
  assert.equal(wordErrorRate('Hola, ¿qué tal?', 'hola qué tal'), 0)
  assert.equal(wordErrorRate('compra leche y pan', 'compra leche'), 0.5)
  assert.equal(wordErrorRate('', ''), null)
})

function session(n = 10, offline = true) {
  return {
    schemaVersion: 1,
    sessions: [{
      id: 'PRUEBA_SINTETICA',
      device: { id: 'virtual-synthetic', model: 'NO ES UN DISPOSITIVO FÍSICO', androidApi: 36, abi: 'arm64-v8a', ramPhysicalMiB: 4096 },
      engine: 'simulado', modelId: 'simulado', operation: 'stt',
      language: 'es-ES', loadState: 'warm',
      offline: { airplaneMode: offline, networkTrafficObserved: false },
      samples: Array.from({ length: n }, (_, i) => ({
        run: i + 1, phraseId: 'es-01', latencyMs: i + 1,
        reference: 'qué eventos tengo hoy', transcript: 'qué eventos tengo hoy',
      })),
    }],
  }
}

test('10 repeticiones no significan motor aprobado: sigue sin validación física', () => {
  const [report] = summarize(session())
  assert.equal(report.status, 'MEDIDO_NO_VALIDADO')
  assert.equal(report.metrics.latencyMs.median, 5.5)
  assert.equal(report.metrics.latencyMs.p95, 10)
  assert.equal(report.wer, 0)
})

test('menos de 10 repeticiones se marca incompleto', () => {
  const [report] = summarize(session(9))
  assert.equal(report.status, 'INCOMPLETO')
})

test('sin prueba offline se marca claramente', () => {
  const [report] = summarize(session(10, false))
  assert.equal(report.status, 'OFFLINE_NO_VERIFICADO')
})

test('rechaza metadatos no válidos y duraciones negativas', () => {
  const bad = session()
  bad.sessions[0].device.androidApi = 0
  assert.throws(() => summarize(bad), /Android API/)
  const negative = session()
  negative.sessions[0].samples[0].latencyMs = -10
  assert.throws(() => summarize(negative), /latencyMs/)
})
