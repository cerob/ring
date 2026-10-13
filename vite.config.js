import { createReadStream, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { defineConfig } from 'vite';

const swiplBundlePath = resolve('node_modules/swipl-wasm/dist/swipl/swipl-bundle.js');
const swiplLicensePath = resolve('node_modules/swipl-wasm/LICENSE.txt');
const crossOriginIsolationHeaders = {
  'Cross-Origin-Opener-Policy': 'same-origin',
  'Cross-Origin-Embedder-Policy': 'require-corp'
};

function swiplBundlePlugin() {
  return {
    name: 'swipl-bundle',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const pathname = req.url?.split('?')[0];
        if (pathname !== '/swipl-bundle.js') {
          next();
          return;
        }

        res.setHeader('Content-Type', 'text/javascript');
        const stream = createReadStream(swiplBundlePath);
        stream.on('error', () => {
          if (!res.headersSent) {
            res.statusCode = 500;
            res.end('Failed to read swipl-bundle.js. Run npm install.');
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
    }
  };
}

export default defineConfig({
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
