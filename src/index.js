import { createFilter } from '@rollup/pluginutils';
import { simple as simpleWalk } from 'acorn-walk';
import postcss from 'postcss';
import { Ranges } from 'ranges-push';
import { rApply as applyRanges } from 'ranges-apply';

/**
 * PostCSS config object. Mirrors what you'd put in a postcss.config.js file. The `to`, `from`, and
 * `map` PostCSS options will be ignored.
 *
 * @typedef PostcssConfig
 *
 * @property {(string|import('postcss').Syntax|import('postcss').Parser)} [parser] - PostCSS parser
 * used to generate AST from a string. If a string is given, then postcss-load-config will require()
 * the parser and pass along the returned instance.
 *
 * @property {(string|import('postcss').Syntax|import('postcss').Stringifier)} [stringifier] - PostCSS
 * stringifier used to generate a string from an AST. If a string is given, then postcss-load-config
 * will require() the stringifier and pass along the returned instance.
 *
 * @property {(string|import('postcss').Syntax)} [syntax] - PostCSS object that can both parse and
 * stringify. If a string is given, the postcss-load-config will require() the syntax and pass along
 * the returned instance.
 *
 * @property {(object|import('postcss').AcceptedPlugin[])} [plugins] - PostCSS plugins to use. This
 * can either be an object or an array of plugins as described by postcss-load-config
 * [here](https://github.com/postcss/postcss-load-config#plugins).
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
 * tagged template literals specified by `tags`. If not given, this will use the PostCSS config in
 * one of the locations supported by postcss-load-config.
 */

/**
 * @type {import('rollup').PluginImpl<(TaggedTemplatePostcssOptions|TaggedTemplatePostcssOptions[])>}
 */
const taggedTemplatePostCss = (options = {}) => {
  const filter = createFilter(options.include, options.exclude);

  return {
    name: 'tagged-template-postcss',

    transform(code, id) {
      if (!filter(id)) {
        return;
      }

      const optionsMap = makeOptionsMap(options);
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
}

/**
 * Create a map from tagged template literal name to the {@link PostcssConfig} object used to
 * transform that template literal's contents.
 *
 * @param {TaggedTemplatePostcssOptions|TaggedTemplatePostcssOptions[]} pluginOptions - Plugin
 * options object received.
 *
 * @returns {Map<string, PostcssConfig>}
 */
const makeOptionsMap = (pluginOptions) => {
  if (!Array.isArray(pluginOptions)) {
    pluginOptions = [pluginOptions];
  }

  const optionsMap = new Map();

  for (const optionsObj of pluginOptions) {
    // XXX: actually load PostCSS config here via postcss-load-config. This way we can cache it
    // and not continuously reload the config during the source walk.
    //
    // For inline config, would like to run it also through postcss-load-config. Unfortunately, it
    // doesn't know how to load from in-memory structure. Maybe use serialize-to-js to write the
    // inline config as a js file that can be loaded from file system?
    const postcssConfig = optionsObj.postcss;

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

export default taggedTemplatePostCss;
