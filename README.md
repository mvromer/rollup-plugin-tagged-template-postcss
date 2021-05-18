# rollup-plugin-tagged-template-postcss

Process the contents of tagged template literals with PostCSS during a Rollup build.

## How it works

For each input file processed by Rollup, this plugin will walk the file's AST (abstract syntax
tree) created by Rollup and look for any tagged template literals whose name matches one of the
names given in the plugin's options. The contents of each tagged template literal that is found will
be processed with PostCSS. The original tagged template literal contents are then replaced with the
output of PostCSS, with any additional transformations needed to ensure the resulting JavaScript is
still syntactically valid.

## Motivation

I originally wrote this as a way to use [TailwindCSS](https://tailwindcss.com/) when styling Web
Components authored using [Lit](https://lit.dev/). With Lit, styles are typically defined inside
component source code using Lit's `css` tagged template literal. This plugin allowed me to use
Tailwind directives directly in my component styles and have PostCSS transform them to valid CSS
prior to bundling my final Web Component output. See the `lit-with-tailwind` scenario test for an
example of this. In general though, this plugin can be used to apply any PostCSS plugin to the
contents of tagged template literal used to define CSS content used in your code.

## Prerequisites

This requires the following minimum versions:

* Node 14
* Rollup 2
* PostCSS 8

## Installation

First, install `rollup-plugin-tagged-template-postcss` as a dev dependency along with its peer
dependencies:

```sh
npm install --save-dev rollup-plugin-tagged-template-postcss rollup postcss
```

Then, inside your Rollup config, import the plugin and added it to your list of Rollup plugins in
your exported config:

```javascript
import taggedTemplatePostcss from 'rollup-plugin-tagged-template-postcss';

export default {
  // Other Rollup options like input, output, etc...
  plugins: [
    taggedTemplatePostcss({
      // List of globs matching input files whose contents will be scanned for the configured tagged
      // template literals. Any tagged template literals whose name matches one of the names in the
      // tags config option will have its contents transformed by PostCSS.
      include: ['src/**/*.js'],

      // Optional list of globs matching input files to exclude from transformation.
      exclude: ['src/**/*.spec.js'],

      // List of tagged template literal names whose contents will be transformed using PostCSS.
      tags: ['css']
    })
  ]
};
```

## PostCSS configuration

This plugin can either configure PostCSS directly through its plugin options or via any PostCSS
config that can be loaded by [postcss-load-config](https://github.com/postcss/postcss-load-config).
If a PostCSS config is defined via both methods, then the one configured through the plugin options
takes precedence.

Passing a PostCSS config as a plugin option can be done as follows:

```javascript
export default {
  plugins: [
    taggedTemplatePostcss({
      // PostCSS config that mirrors what you would put in, e.g., a postcss.config.js file. However,
      // the to, from, and map PostCSS options will be ignored.
      postcss: {
        // PostCSS parser used to generate an AST from a string.
        parser: ...,

        // PostCSS stringifier used to generate a string from an AST.
        stringifier: ...,

        // Syntax object defining both a parser and stringifier for PostCSS to use.
        syntax: ...,

        // Array of PostCSS plugins to use.
        plugins: []
      }
    })
  ]
};
```

## Transforming PostCSS output

The original contents of any tagged template literal processed with PostCSS are ultimately replaced
with the output of PostCSS. However, sometimes this substitution doesn't result in syntactically
valid JavaScript. As an example, the output of Tailwind (prior to minimization) will sometimes
produce CSS that contains comments containing Markdown syntax, like the following:

```css
/**
 * Undo the `border-style: none` reset that Normalize applies to images so that
 * our `border-{width}` utilities have the expected effect.
 *
 * The Normalize reset is unnecessary for us since we default the border-width
 * to 0 on all elements.
 *
 * https://github.com/tailwindcss/tailwindcss/issues/362
 */

img {
  border-style: solid;
}
```

If this were inserted within the contents of a tagged template literal, then the presence of the
backtick characters (e.g., `` `border-style: none` ``) would cause the resulting JavaScript to no
longer have a syntactically valid tagged template literal.

To compensate, this plugin allows one or more *output transformers* to be specified in the plugin's
options. An output transformer is a function that takes a string containing the transformed tagged
template literal contents produced by CSS. The output transformer must return the given string with
any additional transformations applied to it (e.g., escaping). As a simple example, this output
transformer applies no transformations to its given input:

```javascript
export default {
  // Other Rollup options like input, output, etc...
  plugins: [
    taggedTemplatePostcss({
      outputTransformers: [
        (contents) => contents
      ]
    })
  ]
};
```

By default, if no output transformations are given, then a default output transformer is applied
that will generally do the following:

* Escape backslash characters (`\` → `\\`)
* Escape backtick characters (`` ` `` → `` \` ``)
* Escape template literal placeholder openings (`${` → `\${`)

## Plugin configuration schema

Below is a complete schema of the options that can be passed to
`rollup-plugin-tagged-template-postcss`.

```javascript
const pluginConfig = {
  // List of globs used to match the input files that will be processed by this plugin.
  include: [],

  // List of globs used to match the input files that will be excluded by this plugin.
  exclude: [],

  // List of tagged template literal names whose contents will be processed by PostCSS.
  tags: [],

  // Optional PostCSS config that this plugin will use to process the contents of tagged template
  // literals found in the included input files.
  postcss: {
    // PostCSS parser used to generate an AST from a string.
    parser: null,

    // PostCSS stringifier used to generate a string from an AST.
    stringifier: null,

    // PostCSS syntax object defining both a parser and a stringifier.
    syntax: null,

    // List of PostCSS plugins used to process the contents of each tagged template literal found
    // by this plugin.
    plugins: []
  },

  // List of output transformers to apply to the output of PostCSS. Each transformer is a function
  // with the following signature: (string) => string.
  outputTransformers: []
}
```
