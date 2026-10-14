import { createReadStream, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { defineConfig } from 'vite';

const swiplBundlePath = resolve('node_modules/swipl-wasm/dist/swipl/swipl-bundle.js');
const swiplLicensePath = resolve('node_modules/swipl-wasm/LICENSE.txt');
const coiServiceWorkerPath = resolve('node_modules/coi-serviceworker/coi-serviceworker.js');
const crossOriginIsolationHeaders = {
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cross-Origin-Embedder-Policy': 'require-corp'
};

const servedScripts = new Map([
  ['swipl-bundle.js', swiplBundlePath],
  ['coi-serviceworker.js', coiServiceWorkerPath]
]);

function pagesBase() {
  const configured = process.env.VITE_BASE || '/';
  const withLeadingSlash = configured.startsWith('/') ? configured : `/${configured}`;
  return withLeadingSlash.endsWith('/') ? withLeadingSlash : `${withLeadingSlash}/`;
}

function swiplBundlePlugin() {
  return {
    name: 'swipl-bundle',
    configureServer(server) {
      const base = server.config.base;
      server.middlewares.use((req, res, next) => {
        const pathname = req.url?.split('?')[0];
        let filePath;
        for (const [fileName, sourcePath] of servedScripts) {
          if (pathname === `/${fileName}` || pathname === `${base}${fileName}`) {
            filePath = sourcePath;
            break;
          }
        }
        if (!filePath) {
          next();
          return;
        }

        res.setHeader('Content-Type', 'text/javascript; charset=utf-8');
        const stream = createReadStream(filePath);
        stream.on('error', () => {
          if (!res.headersSent) {
            res.statusCode = 500;
            res.end('Failed to read a vendor script. Run npm install.');
          }
        });
        stream.pipe(res);
      });
    },
    generateBundle() {
      this.emitFile({
        type: 'asset',
        fileName: 'swipl-bundle.js',
        source: readFileSync(swiplBundlePath)
      });
      this.emitFile({
        type: 'asset',
        fileName: 'swipl-LICENSE.txt',
        source: readFileSync(swiplLicensePath)
      });
      this.emitFile({
        type: 'asset',
        fileName: 'coi-serviceworker.js',
        source: readFileSync(coiServiceWorkerPath)
      });
    }
  };
}

export default defineConfig({
  base: pagesBase(),
  plugins: [swiplBundlePlugin()],
  optimizeDeps: {
    exclude: ['swipl-wasm']
  },
  build: {
    target: 'esnext'
  },
  server: {
    headers: crossOriginIsolationHeaders
  },
  preview: {
    headers: crossOriginIsolationHeaders
  }
});
