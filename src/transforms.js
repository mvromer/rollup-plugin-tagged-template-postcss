import { pipe } from '@arrows/composition';

/**
 * Convert each occurrence of \ with \\.
 *
 * @param {string} contents
 * @returns {string}
 */
const escapeBackslash = (contents) => contents.replace(/\\/g, '\\\\');

/**
 * Convert each occurrence of ` with \`.
 *
 * @param {string} contents
 * @returns {string}
 */
const escapeBacktick = (contents) => contents.replace(/`/g, '\\`');

/**
 * Convert each occurrence of ${ with \${.
 *
 * @param {string} contents
 * @returns {string}
 */
const escapePlaceholderOpening = (contents) => contents.replace(/\$\{/g, '\\${');

/** @type {import('./plugin.js').TransformFunc} */
export const standardOutputTransform = pipe(
  // Backslash escaping comes first so we don't we don't inadvertently escape any escape sequences
  // subsequent functions in the pipeline add to the transformed output.
  escapeBackslash,
  escapeBacktick,
  escapePlaceholderOpening
);
