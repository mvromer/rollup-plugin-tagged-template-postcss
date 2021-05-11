import autoprefixer from 'autoprefixer';
import postcss from 'rollup-plugin-postcss';
import tailwindcss from 'tailwindcss';

export default {
  input: 'index.js',
  output: {
    format: 'es',
    file: 'dist/bundle.js'
  },
  plugins: [
    postcss({
      extract: 'static/styles.css',
      plugins: [
        tailwindcss(),
        autoprefixer()
      ]
    })
  ]
};
