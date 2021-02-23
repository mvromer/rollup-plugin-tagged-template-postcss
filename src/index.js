import { simple as simpleWalk } from 'acorn-walk';
import { pick } from 'lodash-es';
//import postcss from 'postcss';
import postcssrc from 'postcss-load-config';
import { Ranges } from 'ranges-push';
import { rApply as applyRanges } from 'ranges-apply';
import { createFilter } from '@rollup/pluginutils';
import TraceError from 'trace-error';

/**
 * PostCSS config object. Mirrors what you'd put in a postcss.config.js file. The `to`, `from`, and
 * `map` PostCSS options will be ignored.
 *
 * @typedef PostcssConfig
 *
 * @property {(import('postcss').Syntax|import('postcss').Parser)} [parser] - PostCSS parser
 * used to generate AST from a string.
 *
 * @property {(import('postcss').Syntax|import('postcss').Stringifier)} [stringifier] - PostCSS
 * stringifier used to generate a string from an AST.
 *
 * @property {(import('postcss').Syntax)} [syntax] - Syntax object defining both a parser and
 * stringifier for PostCSS to use.
 *
 * @property {(import('postcss').AcceptedPlugin[])} [plugins] - PostCSS plugins to use.
 */

/**
 * Options used to configure rollup-plugin-tagged-template-postcss.
 *
 * @typedef TaggedTemplatePostcssOptions
 *
 * @property {string[]} include - List of patterns of source files to process.
 *
 * @property {string[]} exclude - List of patterns of sources file exclude from processing.
 *
 * @property {string[]} tags - List of tagged template literal names whose contents will be
 * transformed using PostCSS.
 *
 * @property {PostcssConfig} [postcss] - PostCSS config used to transform the contents of the
 * tagged template literals specified by `tags`. If not given, this will use
 * [postcss-load-config](https://github.com/postcss/postcss-load-config#readme) to load a PostCSS
 * config from one of its supported locations.
 */

/**
 * @type {import('rollup').PluginImpl<(TaggedTemplatePostcssOptions|TaggedTemplatePostcssOptions[])>}
 */
const taggedTemplatePostCss = (options = {}) => {
  const filter = createFilter(options.include, options.exclude);

  return {
    name: 'tagged-template-postcss',

    async transform(code, id) {
      if (!filter(id)) {
        return;
      }

      const optionsMap = await makeOptionsMap(options);
      const transformRanges = new Ranges();
      const ast = this.parse(code);
      const baseWalker = undefined;

      simpleWalk(ast, {
        TaggedTemplateExpression(node, ranges) {
          if (optionsMap.has(node.tag.name)) {
            // NOTE: Offset the start/end by +/-1 because we don't want to include the backtick
            // characters when we extract the template literal's contents.
            const literalStart = node.quasi.start + 1;
            const literalEnd = node.quasi.end - 1;
            const originalLiteral = code.substring(literalStart, literalEnd);

            // XXX: Get options from map or load if they don't exist. Pass to PostCSS.
            const transformedLiteral = originalLiteral;
            console.log(optionsMap.get(node.tag.name));

            ranges.push(literalStart, literalEnd, transformedLiteral);
          }
        }
      }, baseWalker, transformRanges);

      return {
        code: applyRanges(code, transformRanges.current()),
        map: null
      };
    }
  };
};

/**
 * PostCSS options recognized by this plugin. In particular, the `to`, `from`, and `map` options, if
 * specified, will be ignored.
 *
 * @typedef PostcssOptions
 *
 * @property {(import('postcss').Syntax|import('postcss').Parser)} [parser] - PostCSS parser
 * used to generate AST from a string.
 *
 * @property {(import('postcss').Syntax|import('postcss').Stringifier)} [stringifier] - PostCSS
 * stringifier used to generate a string from an AST.
 *
 * @property {(import('postcss').Syntax)} [syntax] - Syntax object defining both a parser and
 * stringifier for PostCSS to use.
 */

/**
 * PostCSS config resolved via {@link resolvePostcssConfig}.
 *
 * @typedef ResolvedPostcssConfig
 *
 * @property {PostcssOptions} [options] - PostCSS options to use.
 *
 * @property {(import('postcss').AcceptedPlugin[])} [plugins] - PostCSS plugins to use.
 */

/**
 * Create a map from tagged template literal name to the {@link PostcssConfig} object used to
 * transform that template literal's contents.
 *
 * @param {TaggedTemplatePostcssOptions|TaggedTemplatePostcssOptions[]} pluginOptions - Plugin
 * options object received.
 *
 * @returns {Promise<Map<string, PostcssConfig>>}
 */
const makeOptionsMap = async (pluginOptions) => {
  if (!Array.isArray(pluginOptions)) {
    pluginOptions = [pluginOptions];
  }

  const optionsMap = new Map();

  for (const optionsObj of pluginOptions) {
    let postcssConfig;

    try {
      postcssConfig = await resolvePostcssConfig(optionsObj.postcss);
    }
    catch (e) {
      throw new TraceError(`PostCSS config missing for tag set ${optionsObj.tags}`, e);
    }

    // Expand out for each tagged template literal name given in the current options instance.
    for (const tag of optionsObj.tags) {
      if (optionsMap.has(tag)) {
        throw new Error(`PostCSS config already defined for tagged template literal ${tag}`);
      }

      optionsMap.set(tag, postcssConfig);
    }
  }

  return optionsMap;
};

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

export default taggedTemplatePostCss;
