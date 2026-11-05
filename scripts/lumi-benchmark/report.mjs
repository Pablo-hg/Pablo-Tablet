#!/usr/bin/env node
// Informe reproducible de mediciones de Lumi. No ejecuta motores ni inventa resultados.
// Uso: node scripts/lumi-benchmark/report.mjs ruta/a/mediciones.json
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

export function median(values) {
  if (!values.length) return null
  const ordered = [...values].sort((a, b) => a - b)
  const middle = Math.floor(ordered.length / 2)
  return ordered.length % 2 ? ordered[middle] : (ordered[middle - 1] + ordered[middle]) / 2
}

export function p95(values) {
  if (!values.length) return null
  const ordered = [...values].sort((a, b) => a - b)
  return ordered[Math.ceil(0.95 * ordered.length) - 1] // nearest rank
}

function words(text) {
  return String(text).normalize('NFC').toLocaleLowerCase().replace(/[^\p{L}\p{N}\s']/gu, ' ').split(/\s+/).filter(Boolean)
}

function editDistance(a, b) {
  let previous = Array.from({ length: b.length + 1 }, (_, i) => i)
  for (let i = 1; i <= a.length; i++) {
    const current = [i]
    for (let j = 1; j <= b.length; j++) {
      current[j] = Math.min(
        previous[j] + 1,
        current[j - 1] + 1,
        previous[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      )
    }
    previous = current
  }
  return previous[b.length]
}

export function wordErrorRate(reference, hypothesis) {
  const expected = words(reference)
  if (!expected.length) return null
  return editDistance(expected, words(hypothesis)) / expected.length
}

function requiredText(value, label) {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`Campo obligatorio: ${label}`)
  return value
}

function numericSample(sample, field) {
  const value = sample[field]
  if (value === undefined || value === null) return null
  if (typeof value !== 'number' || !Number.isFinite(value) || value < 0) {
    throw new Error(`Medición ${field} inválida: ${String(value)}`)
  }
  return value
}

function stats(samples, field) {
  const values = samples.map((sample) => numericSample(sample, field)).filter((v) => v !== null)
  return { count: values.length, median: median(values), p95: p95(values) }
}

export function summarize(document) {
  if (!document || document.schemaVersion !== 1 || !Array.isArray(document.sessions)) {
    throw new Error('Se requiere schemaVersion=1 y un array sessions.')
  }

  return document.sessions.map((session, index) => {
    const id = requiredText(session.id, `sessions[${index}].id`)
    const device = session.device || {}
    requiredText(device.id, `${id}.device.id`)
    requiredText(device.model, `${id}.device.model`)
    const androidApi = device.androidApi
    if (!Number.isInteger(androidApi) || androidApi < 1) throw new Error(`Android API inválida en ${id}`)
    if (!Number.isFinite(device.ramPhysicalMiB) || device.ramPhysicalMiB <= 0) throw new Error(`RAM real inválida en ${id}`)
    const engine = requiredText(session.engine, `${id}.engine`)
    const modelId = requiredText(session.modelId, `${id}.modelId`)
    const language = requiredText(session.language, `${id}.language`)
    if (!['stt', 'tts'].includes(session.operation)) throw new Error(`Operación inválida en ${id}`)
    if (!['cold', 'warm'].includes(session.loadState)) throw new Error(`Estado frío/caliente inválido en ${id}`)
    if (!Array.isArray(session.samples)) throw new Error(`Falta samples en ${id}`)
    const timings = session.operation === 'stt'
      ? ['loadMs', 'latencyMs', 'peakRssMiB']
      : ['loadMs', 'firstAudioMs', 'totalAudioMs', 'peakRssMiB']
    const metrics = Object.fromEntries(timings.map((field) => [field, stats(session.samples, field)]))
    const critical = session.operation === 'stt' ? ['latencyMs'] : ['firstAudioMs', 'totalAudioMs']
    const validCount = Math.min(...critical.map((k) => metrics[k].count))
    const offlineVerified = session.offline?.airplaneMode === true && session.offline?.networkTrafficObserved === false

    const werPairs = session.operation === 'stt' ? session.samples.filter(
      (sample) => typeof sample.reference === 'string' && sample.reference.trim() &&
        typeof sample.transcript === 'string',
    ) : []
    const referenceWords = werPairs.reduce((acc, s) => acc + words(s.reference).length, 0)
    const errors = werPairs.reduce((acc, s) => acc + editDistance(words(s.reference), words(s.transcript)), 0)
    let status = 'MEDIDO_NO_VALIDADO'
    if (validCount < 10) status = 'INCOMPLETO'
    else if (!offlineVerified) status = 'OFFLINE_NO_VERIFICADO'

    return {
      id,
      device: { id: device.id, model: device.model, androidApi, abi: device.abi ?? null, ramPhysicalMiB: device.ramPhysicalMiB },
      engine, modelId, engineVersion: session.engineVersion ?? null,
      operation: session.operation, language, loadState: session.loadState,
      samples: session.samples.length, validCount, status, offlineVerified,
      metrics,
      wer: referenceWords ? errors / referenceWords : null,
      warnings: [
        ...(validCount < 10 ? ['Se necesitan al menos 10 mediciones válidas por condición.'] : []),
        ...(!offlineVerified ? ['Modo avión y ausencia de tráfico de red no verificados.'] : []),
        ...(session.operation === 'stt' && !referenceWords ? ['Sin transcripciones de referencia para calcular WER.'] : []),
      ],
    }
  })
}

if (process.argv[1] && fileURLToPath(import.meta.url) === resolve(process.argv[1])) {
  if (!process.argv[2]) {
    console.error('Uso: node scripts/lumi-benchmark/report.mjs <mediciones.json>')
    process.exitCode = 2
  } else {
    try {
      const measurements = JSON.parse(readFileSync(resolve(process.argv[2]), 'utf8'))
      const reports = summarize(measurements)
      console.log(JSON.stringify({
        generatedAt: new Date().toISOString(),
        status: 'NO SE APRUEBA AUTOMÁTICAMENTE NINGÚN MOTOR. Requiere revisión y pruebas físicas.',
        reports,
      }, null, 2))
      if (reports.some((r) => r.status !== 'MEDIDO_NO_VALIDADO')) process.exitCode = 1
    } catch (error) {
      console.error(error instanceof Error ? error.message : String(error))
      process.exitCode = 2
    }
  }
}
