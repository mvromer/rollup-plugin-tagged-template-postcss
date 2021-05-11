import path from 'path';
import { fileURLToPath } from 'url';
import autoprefixer from 'autoprefixer';
import { expect } from 'chai';
import chdir from '@dword-design/chdir';
import { nodeResolve } from '@rollup/plugin-node-resolve';
import * as rollup from 'rollup';
import tailwindcss from 'tailwindcss';

import taggedTemplatePostCss from '../../../src/index.js';

describe('Lit with TailwindCSS', function () {
  context('when Lit component uses Tailwind in styles', function () {
    it('should produce valid JavaScript bundle', async function () {
      this.timeout(0);
      const scenarioDir = path.dirname(fileURLToPath(import.meta.url));

      await chdir(scenarioDir, async () => {
        const bundle = await rollup.rollup({
          input: 'index.js',
          plugins: [
            nodeResolve(),
            taggedTemplatePostCss({
              include: ['index.js'],
              exclude: [],
              tags: ['css'],
              postcss: {
                plugins: [
                  tailwindcss({
                    mode: 'jit',
                    purge: ['index.js']
                  }),
                  autoprefixer()
                ]
              }
            })
          ]
        });

        const { output } = await bundle.generate({
          format: 'es',
          file: 'dist/bundle.js'
        });
        const outputChunk = output.find(chunkOrAsset => chunkOrAsset.type === 'chunk');

        expect(outputChunk.code).to.matchVerbatimSnapshot();
      });
    });
  });
});
