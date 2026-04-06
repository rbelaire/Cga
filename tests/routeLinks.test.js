import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'

const repoRoot = path.resolve('.')

function read(filePath) {
  return fs.readFileSync(path.join(repoRoot, filePath), 'utf8')
}

function collectRoutePaths(appSource) {
  const routes = [...appSource.matchAll(/<Route\s+path="([^"]+)"/g)].map(match => match[1])
  return new Set(routes)
}

function collectInternalToValues(source) {
  return [...source.matchAll(/\bto="(\/[^"]*)"/g)].map(match => match[1])
}

const appSource = read('src/App.jsx')
const routes = collectRoutePaths(appSource)

const dynamicRoutePrefixes = ['/pairings/', '/tournaments/']

function routeExists(target) {
  if (routes.has(target)) return true
  if (dynamicRoutePrefixes.some(prefix => target.startsWith(prefix))) return true
  return false
}

test('all static internal links point to defined routes', () => {
  const filesToCheck = [
    'src/components/layout/Header.jsx',
    'src/components/layout/Footer.jsx',
    'src/components/sections/QuickLinks.jsx',
    'src/components/sections/SponsorBar.jsx',
    'src/components/ui/TournamentCard.jsx',
    'src/pages/Home.jsx',
    'src/pages/Pairings.jsx',
    'src/pages/TournamentDetail.jsx',
    'src/App.jsx',
  ]

  const missingTargets = []

  for (const filePath of filesToCheck) {
    const source = read(filePath)
    const targets = collectInternalToValues(source)
    for (const target of targets) {
      if (!routeExists(target)) {
        missingTargets.push(`${filePath}: ${target}`)
      }
    }
  }

  assert.deepEqual(missingTargets, [])
})

test('vite base path and hash router are configured for GitHub Pages', () => {
  const viteConfig = read('vite.config.js')
  assert.match(viteConfig, /base:\s*'\/Cga\/'/)
  assert.match(appSource, /<HashRouter>/)
})


test('404 fallback redirects deep links to hash routes', () => {
  const fallback = read('public/404.html')
  assert.match(fallback, /window\.location\.replace\(nextUrl\)/)
  assert.match(fallback, /var\s+base\s*=\s*'\/Cga\/'/)
})

test('sponsor data does not use placeholder domains', () => {
  const sponsors = JSON.parse(read('src/data/sponsors.json'))
  const badUrls = Object.values(sponsors)
    .flat()
    .map(entry => entry.url)
    .filter(url => typeof url === 'string' && /example\.com/i.test(url))

  assert.deepEqual(badUrls, [])
})
