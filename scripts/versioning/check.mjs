#!/usr/bin/env node
import { checkProjectVersion } from './project-version.mjs'

try {
  const expected = process.argv[2]
  const version = checkProjectVersion(process.cwd(), expected)
  console.log('Versionado coherente: npm, lockfile y Android = ' + version)
  console.log('APK DEV (Gradle debug): ' + version + '-dev')
} catch (error) {
  console.error('[versionado] ' + error.message)
  process.exitCode = 1
}
