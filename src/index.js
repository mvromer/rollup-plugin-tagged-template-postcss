import { createFilter } from '@rollup/pluginutils';
import { simple as simpleWalk } from 'acorn-walk';
import { Ranges } from 'ranges-push';
import { rApply as applyRanges } from 'ranges-apply';

/**
 * Options used to configure rollup-plugin-tagged-template-postcss.
 *
 * @typedef TaggedTemplatePostcssOptions
 *
 * @property {string[]} include - List of patterns of source files to process.
 * @property {string[]} exclude - List of patterns of sources file exclude from processing.
 * @property {string[]} tags - List of tagged template literal names whose contents will be
 * transformed using PostCSS.
 */

/**
 * @type {import('rollup').PluginImpl<TaggedTemplatePostcssOptions>}
 */
const taggedTemplatePostCss = (options = {}) => {
  const filter = createFilter(options.include, options.exclude);

  return {
    name: 'tagged-template-postcss',

    transform(code, id) {
      if (!filter(id)) {
        return;
      }

      const {
        tags = []
      } = options;

      // General idea:
      //   1. Find all TaggedTemplateExpression (TTE) nodes
      //   2. Verify TTE node has tag with name matching one of options[].tags
      //   3. Extract template literal by taking substring of input code from
      //      start = tteNode.quasi.start + 1 to end = tteNode.quasi.end - 1. The +/-1 is to trim
      //      the backtick characters from the extracted code substring.
      //   4. Process the template literal contents through PostCSS using the corresponding
      //      options[].postcssConfig.
      //   5. Save in the state a (templateStart, templateEnd, transformedTemplate) triple using the
      //      computed start, end, and transformed output returned by PostCSS.
      //   6. After walking the AST, process each triple and replace the template literal from
      //      [start, end) with the corresponding transformed output.

      const transformRanges = new Ranges();
      const ast = this.parse(code);
      const baseWalker = undefined;

      simpleWalk(ast, {
        TaggedTemplateExpression(node, ranges) {
          if (tags.includes(node.tag.name)) {
            // NOTE: Offset the start/end by +/-1 because we don't want to include the backtick
            // characters when we extract the template literal's contents.
            const literalStart = node.quasi.start + 1;
            const literalEnd = node.quasi.end - 1;
            const originalLiteral = code.substring(literalStart, literalEnd);

            // XXX: Run PostCSS
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

export default taggedTemplatePostCss;
