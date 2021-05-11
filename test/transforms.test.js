import { expect } from 'chai';
import { standardOutputTransform } from '../src/transforms.js';

describe('Standard output transforms', function () {
  context('when given string requiring no escapes', function () {
    it('should return the same string', function () {
      const input = String.raw`Example string`;
      expect(standardOutputTransform(input)).to.matchVerbatimSnapshot();
    });
  });

  context('when given string contains backslashes', function () {
    it('should escape a single backslash', function () {
      const input = String.raw`Example \t string`;
      expect(standardOutputTransform(input)).to.matchVerbatimSnapshot();
    });

    it('should escape multiple backslashes', function () {
      const input = String.raw`Example \t\t string`;
      expect(standardOutputTransform(input)).to.matchVerbatimSnapshot();
    });
  });

  context('when given string contains backticks', function () {
    it('should escape a single backtick', function () {
      const input = 'Example ` string';
      expect(standardOutputTransform(input)).to.matchVerbatimSnapshot();
    });

    it('should escape multiple backticks', function () {
      const input = 'Example `` string';
      expect(standardOutputTransform(input)).to.matchVerbatimSnapshot();
    });
  });

  context('when given string contains template placeholders', function () {
    it('should escape a single placeholder', function () {
      // eslint-disable-next-line quotes
      const input = "Example ${'placeholder'} string";
      expect(standardOutputTransform(input)).to.matchVerbatimSnapshot();
    });

    it('should escape multiple placeholders', function () {
      // eslint-disable-next-line quotes
      const input = "Example ${'multi'} ${'placeholder'} string";
      expect(standardOutputTransform(input)).to.matchVerbatimSnapshot();
    });
  });

  context('when given string contains a placeholder containing backticks', function () {
    it('should properly escape placeholders and backticks', function () {
      // eslint-disable-next-line quotes
      const input = "Example ${`nested ${'placeholder'}`} string";
      expect(standardOutputTransform(input)).to.matchVerbatimSnapshot();
    });
  });
});
