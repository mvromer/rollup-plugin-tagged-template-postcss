import { pipe } from '@arrows/composition';
import { simple as simpleWalk } from 'acorn-walk';
import postcss from 'postcss';
import { Ranges } from 'ranges-push';

/**
 * Template literal contents targeted for transformation via PostCSS.
 *
 * @typedef TransformTarget
 *
 * @property {number} start Index in a code string pointing to the start of the template literal
 * contents to transform.
 *
 * @property {number} end Index in a code string pointing to one past the end of the template
 * literal contents to transform.
 *
 * @property {string} literalContents Contents of the template literal to transform.
 *
 * @property {ProcessTagConfig} processTagConfig Config specifying how to transform the template
 * literal's contents.
 */

/**
 * Specifies how to transform the contents of a tagged template literal using PostCSS and additional
 * transformers.
 *
 * @typedef ProcessTagConfig
 *
 * @property {import('./plugin.js').ResolvedPostcssConfig} postcssConfig Resolved PostCSS config used
 * to transform the template literal contents.
 *
 * @property {import('./plugin.js').TransformFunc[]} outputTransforms Transform functions applied to
 * the template literal contents after is has been transformed by PostCSS.
 */

/**
 * Builds the list of tagged template literal contents targeted for transformation by this plugin.
 *
 * @callback FindTransformTargetsFunc
 *
 * @param {import('rollup').AcornNode} ast ESTree compliant abstract syntax tree of the module code
 * received from Rollup. This will be walked when looking for possible tagged template literals to
 * target for transformation.
 *
 * @returns {TransformTarget[]} Array of targets in the given AST to transform.
 */

/**
 * Builds a pipeable function that receives an AST and returns a list of tagged template literals to
 * target for transformation by this plugin.
 *
 * @param {string} code Module code received from Rollup.
 *
 * @param {Map<string, ProcessTagConfig>} tagMap Map of tagged template literal tag name to the
 * {@link ProcessTagConfig} used to transform that tagged template literal's contents.
 *
 * @returns {FindTransformTargetsFunc}
 */
export const findTransformTargets = (code, tagMap) => (ast) => {
  /** @type {TransformTarget[]} */
  const transformTargets = [];
  const baseWalker = null;

  // Walk the AST and gather the contents of each tagged template literal that will be transformed.
  // Since acorn-walk doesn't support async callbacks, which is needed to invoke PostCSS directly,
  // we just gather location and contents of each targeted tagged template literal during the walk.
  // Transformations are applied once all targets are gathered.
  simpleWalk(ast, {
    TaggedTemplateExpression(node, targets) {
      if (tagMap.has(node.tag.name)) {
        // NOTE: Offset the start/end by +/-1 because we don't want to include the backtick
        // characters when we extract the template literal's contents.
        const literalStart = node.quasi.start + 1;
        const literalEnd = node.quasi.end - 1;

        targets.push({
          start: literalStart,
          end: literalEnd,
          literalContents: code.substring(literalStart, literalEnd),
          processTagConfig: tagMap.get(node.tag.name)
        });
      }
    }
  }, baseWalker, transformTargets);

  return transformTargets;
};

/**
 * Builds a {@link Ranges} object from an array of {@link TransformTarget} objects.
 *
 * @callback MakeTransformRangesFunc
 *
 * @param {TransformTarget[]} transformTargets Array of transform targets to convert.
 *
 * @returns {Promise<import('ranges-push').Ranges>} Promise resolving to a {@link Ranges} object
 * built from the given array of {@link TransformTarget} objects. Each {@link Range} specifies the
 * location of a tagged template literal's contents in the module code received from Rollup along
 * with the transformed contents to replace it with.
 *
 * @returns {Promise<Object>} Promise resolving to an object containing both a {@link Ranges} object
 * built from the given array of {@link TransformTarget} objects and an array of dependencies. Each
 * {@link Range} specifies the location of a tagged template literal's contents in the module code
 * received from Rollup along with the transformed contents to replace it with as returned by
 * PostCSS. The dependencies arrays contain the file and directory paths identified by any of the
 * configured PostCSS plugins as dependencies of the transformed tagged template literal contents.
 */

/**
 * Builds a pipeable function that receives an array of {@link TransformTarget} objects and converts
 * it into a {@link Ranges} object.
 *
 * @param {string} moduleId Module ID received from Rollup. Used for specifying the `to` and `from`
 * PostCSS options the resulting function uses when transforming a {@link TransformTarget}.
 *
 * @returns {MakeTransformRangesFunc}
 */
export const makeTransformRanges = (moduleId) => async (transformTargets) => {
  const transformRanges = new Ranges();
  const dependencies = new Set();

  for (const target of transformTargets) {
    const postcssOptions = Object.assign({
      from: moduleId,
      to: moduleId
    }, target.processTagConfig.postcssConfig.options);

    const postcssResult = await postcss(target.processTagConfig.postcssConfig.plugins)
      .process(target.literalContents, postcssOptions);

    transformRanges.push(
      target.start,
      target.end,
      pipe.now(postcssResult.css, ...target.processTagConfig.outputTransforms)
    );

    // Get all the dependencies identified by PostCSS. Historically, directory dependencies have
    // been marked by some plugins with the 'context-dependency' message type (and in that case,
    // they use the file property to signify the path). We're lucky in that Rollup's addWatchFile
    // utility function can take paths to both files and directories.
    //
    // Latest PostCSS plugin message guidance here:
    // https://github.com/postcss/postcss/blob/main/docs/guidelines/plugin.md
    for (const message of postcssResult.messages) {
      if (message.type === 'dependency' || message.type === 'context-dependency') {
        dependencies.add(message.file);
      }
      else if (message.type === 'dir-dependency') {
        dependencies.add(message.dir);
      }
    }
  }

  return {
    transformRanges,
    dependencies: Array.from(dependencies)
  };
};
