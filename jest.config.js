const { compilerOptions } = require('./tsconfig.json');
const { pathsToModuleNameMapper } = require('ts-jest');

module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['**/*.test.ts'],
  moduleFileExtensions: ['ts', 'js', 'json', 'node'],

  // Resolve tsconfig "paths" aliases
  moduleNameMapper: pathsToModuleNameMapper(
    compilerOptions.paths || {},
    { prefix: '<rootDir>/' }
  ),

  // Respect baseUrl if defined
  modulePaths: compilerOptions.baseUrl
    ? [`<rootDir>/${compilerOptions.baseUrl}`]
    : ['<rootDir>'],
};
