// Instala únicamente los comandos npm de la automatización. No crea tags, PR ni APK.
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { join } from 'node:path'

const root = process.cwd()
const path = join(root, 'package.json')
if (!existsSync(path) || !existsSync(join(root, 'scripts/release/cli.mjs'))) {
  console.error('Ejecuta esto desde la raíz de Pablo Tablet después de copiar scripts/release/.')
  process.exit(1)
}
const packageJson = JSON.parse(readFileSync(path, 'utf8'))
if (packageJson.name !== 'pablo-tablet') {
  console.error(`El paquete esperado es pablo-tablet; encontrado ${packageJson.name}`)
  process.exit(1)
}
packageJson.scripts ??= {}
for (const action of ['check', 'prepare', 'validate', 'submit', 'merge', 'publish', 'verify']) {
  const key = `release:${action}`
  const value = `node scripts/release/cli.mjs ${action}`
  if (packageJson.scripts[key] && packageJson.scripts[key] !== value) {
    console.error(`El script ${key} ya existe con otro valor. No se ha sobrescrito.`)
    process.exit(1)
  }
}
for (const action of ['check', 'prepare', 'validate', 'submit', 'merge', 'publish', 'verify']) {
  packageJson.scripts[`release:${action}`] = `node scripts/release/cli.mjs ${action}`
}
const actual = readFileSync(path, 'utf8')
const updated = JSON.stringify(packageJson, null, 2) + '\n'
if (actual !== updated) writeFileSync(path, updated, 'utf8')
console.log('Comandos npm añadidos a package.json. No se ha modificado ninguna versión ni publicado nada.')
