import path from 'path';
import { expect } from 'chai';
import { loadTestData, normalizeModuleBaseDir } from './helpers.js';
import { standardOutputTransform } from '../src/transforms.js';

describe('Standard output transforms', function () {
  let testData;

  before(async function() {
    testData = await loadTestData(path.posix.join(normalizeModuleBaseDir(import.meta.url), 'data', 'standard-output-transform'));
  });

  const testStandardOutputTransform = (testName) =>
    expect(standardOutputTransform(testData[testName].input)).to.equal(testData[testName].expected);

  context('when given string requiring no escapes', function() {
    it('should return the same string', function() {
      testStandardOutputTransform('no-escaping');
    });
  });

  context('when given string contains backslashes', function () {
    it('should escape a single backslash', function (){
      testStandardOutputTransform('single-backslash');
    });

    it('should escape multiple backslashes', function (){
      testStandardOutputTransform('multi-backslash');
    });
  });

  context('when given string contains backticks', function () {
    it('should escape a single backtick', function (){
      testStandardOutputTransform('single-backtick');
    });

    it('should escape multiple backticks', function (){
      testStandardOutputTransform('multi-backtick');
    });
  });

  context('when given string contains template placeholders', function () {
    it('should escape a single placeholder', function (){
      testStandardOutputTransform('single-placeholder');
    });

    it('should escape multiple placeholders', function (){
      testStandardOutputTransform('multi-placeholder');
    });
  });

  context('when given string contains a placeholder containing backticks', function (){
    it('should properly escape placeholders and backticks', function () {
      testStandardOutputTransform('backtick-in-placeholder');
    });
  });
});
