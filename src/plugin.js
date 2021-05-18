import { railAsync } from '@arrows/composition';
import { pick } from 'lodash-es';
import postcssrc from 'postcss-load-config';
import { createFilter } from '@rollup/pluginutils';
import { rApply as applyRanges } from 'ranges-apply';
import TraceError from 'trace-error';
import { findTransformTargets, makeTransformRanges } from './targets.js';
import { standardOutputTransform } from './transforms.js';

/**
 * Options used to configure rollup-plugin-tagged-template-postcss.
 *
 * @typedef TaggedTemplatePostcssOptions
 *
 * @property {string[]} include - List of patterns of source files to process.
 *
 * @property {string[]} [exclude] - List of patterns of sources file exclude from processing.
 *
 * @property {string[]} tags - List of tagged template literal names whose contents will be
 * transformed using PostCSS.
 *
 * @property {PostcssConfig} [postcss] - PostCSS config used to transform the contents of the tagged
 * template literals specified by `tags`. If not given, this will use
 * [postcss-load-config](https://github.com/postcss/postcss-load-config#readme) to load a PostCSS
 * config from one of its supported locations.
 *
 * @property {TransformFunc[]} [outputTransforms] Additional transform functions to apply to the
 * tagged template literal's contents AFTER it has been processed by PostCSS. Transform functions
 * are applied in the order in which they appear.
 *
 * If this is not given, a standard transform function is applied that 1) escapes each backslash,
 * 2) escapes each backtick, and 3) escapes each dollar sign followed by an open curly brace (which
 * is inferred to be the start of a template literal placeholder).
 *
 * If you want to apply no transforms, then set this to an empty array.
 */

/**
 * PostCSS config object. Mirrors what you'd put in a postcss.config.js file. The `to`, `from`, and
 * `map` PostCSS options will be ignored.
 *
 * @typedef PostcssConfig
 *
 * @property {(import('postcss').Syntax|import('postcss').Parser)} [parser] PostCSS parser used to
 * generate AST from a string.
 *
 * @property {(import('postcss').Syntax|import('postcss').Stringifier)} [stringifier] PostCSS
 * stringifier used to generate a string from an AST.
 *
 * @property {(import('postcss').Syntax)} [syntax] Syntax object defining both a parser and
 * stringifier for PostCSS to use.
 *
 * @property {(import('postcss').AcceptedPlugin[])} [plugins] PostCSS plugins to use.
 */

/**
 * Transform function applied to the output of PostCSS.
 *
 * @callback TransformFunc
 *
 * @param {string} transformedLiteralContents Contents of a tagged template literal that has
 * already been transformed by PostCSS and any prior transform functions.
 *
 * @returns {string} The template literal contents with this function's transformations applied.
 */

/**
 * @type {import('rollup').PluginImpl<(TaggedTemplatePostcssOptions|TaggedTemplatePostcssOptions[])>}
 */
export const taggedTemplatePostcss = (options = {}) => {
  const filter = createFilter(options.include, options.exclude);

  return {
    name: 'tagged-template-postcss',

    async transform(code, id) {
      if (!filter(id)) {
        return;
      }

      const transformCode = railAsync(
        this.parse,
        findTransformTargets(code, await makeTagMap(options)),
        makeTransformRanges(id),
        (transformRanges) => applyRanges(code, transformRanges.current())
      );

      return {
        code: await transformCode(code),
        map: null
      };
    }
  };
};

/**
 * Create a map from tagged template literal name to the {@link ProcessTagConfig} object used to
 * transform that template literal's contents.
 *
 * @param {TaggedTemplatePostcssOptions|TaggedTemplatePostcssOptions[]} pluginOptions Plugin
 * options object received.
 *
 * @returns {Promise<Map<string, import('./targets').ProcessTagConfig>>}
 */
const makeTagMap = async (pluginOptions) => {
  if (!Array.isArray(pluginOptions)) {
    pluginOptions = [pluginOptions];
  }

  const tagMap = new Map();

  for (const optionsObj of pluginOptions) {
    let postcssConfig;

    try {
      postcssConfig = await resolvePostcssConfig(optionsObj.postcss);
    }
    catch (e) {
      throw new TraceError(`PostCSS config missing for tag set ${optionsObj.tags}`, e);
    }

    const processTagConfig = {
      postcssConfig,
      outputTransforms: optionsObj.outputTransforms || [standardOutputTransform]
    };

    // Expand out for each tagged template literal name given in the current options instance.
    for (const tag of optionsObj.tags) {
      if (tagMap.has(tag)) {
        throw new Error(`PostCSS config already defined for tagged template literal ${tag}`);
      }

      tagMap.set(tag, processTagConfig);
    }
  }

  return tagMap;
};

/**
 * PostCSS config resolved via {@link resolvePostcssConfig}.
 *
 * @typedef ResolvedPostcssConfig
 *
 * @property {PostcssOptions} [options] PostCSS options to use.
 *
 * @property {(import('postcss').AcceptedPlugin[])} [plugins] PostCSS plugins to use.
 */

/**
 * PostCSS options recognized by this plugin. In particular, the `to`, `from`, and `map` options, if
 * specified, will be ignored.
 *
 * @typedef PostcssOptions
 *
 * @property {(import('postcss').Syntax|import('postcss').Parser)} [parser] PostCSS parser
 * used to generate AST from a string.
 *
 * @property {(import('postcss').Syntax|import('postcss').Stringifier)} [stringifier] PostCSS
 * stringifier used to generate a string from an AST.
 *
 * @property {(import('postcss').Syntax)} [syntax] Syntax object defining both a parser and
 * stringifier for PostCSS to use.
 */

/**
 * Takes the PostCSS config given in the options passed to this plugin and resolves it to a set of
 * PostCSS options and plugins. If a config isn't given, then one will be loaded via
 * postcss-load-config.
 *
 * @param {PostcssConfig} postcssConfig - A PostCSS config set in the options passed to this plugin.
 *
 * @returns {Promise<ResolvedPostcssConfig>} A promise that resolves to an object specifying the
 * PostCSS options and plugins specified by the given config (or the one loaded by
 * postcss-load-config if a config wasn't given).
 */
const resolvePostcssConfig = async (postcssConfig) => {
  const acceptedOptions = ['parser', 'stringifier', 'syntax'];

  if (postcssConfig) {
    const {
      plugins = [],
      ...options
    } = postcssConfig;

    return {
      plugins,
      options: pick(options, acceptedOptions)
    };
  }

  const loadResult = await postcssrc();
  return {
    plugins: loadResult.plugins,
    options: pick(loadResult.options, acceptedOptions)
  };
};
