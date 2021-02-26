import fs from 'fs';
import path from 'path';
import url from 'url';
import fastGlob from 'fast-glob';
import normalizePath from 'normalize-path';

export const loadTestData = async (testDataRoot) => {
  const testData = {};
  const dataStream = fastGlob.stream(`${testDataRoot}/**/*`, { objectMode: true });

  for await (const dataFile of dataStream) {
    const testDataContents = fs.readFileSync(dataFile.path, 'utf-8');
    const testName = path.basename(path.dirname(dataFile.path));

    if (!testData[testName]) {
      testData[testName] = {};
    }

    if (dataFile.name.startsWith('input')) {
      testData[testName].input = testDataContents;
    }
    else if (dataFile.name.startsWith('expected')) {
      testData[testName].expected = testDataContents;
    }
    else {
      throw new Error(`Invalid test data file ${dataFile.path}`);
    }
  }

  return testData;
};

export const normalizeModuleBaseDir = (moduleFileUrl) => normalizePath(path.dirname(url.fileURLToPath(moduleFileUrl)));
