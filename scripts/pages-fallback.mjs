import { copyFile, mkdir } from 'node:fs/promises'

const output = 'dist/client'
await mkdir(output, { recursive: true })
await copyFile(`${output}/index.html`, `${output}/404.html`)
