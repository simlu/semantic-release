import path from 'path';
import test from 'ava';
import {copy, outputFile} from 'fs-extra';
import {stub} from 'sinon';
import tempy from 'tempy';
import getPlugins from '../../lib/plugins';

// Save the current working diretory
const cwd = process.cwd();

test.beforeEach(t => {
  // Stub the logger functions
  t.context.log = stub();
  t.context.logger = {log: t.context.log};
});

test.afterEach.always(() => {
  // Restore the current working directory
  process.chdir(cwd);
});

test('Export default plugins', t => {
  const plugins = getPlugins({}, {}, t.context.logger);

  // Verify the module returns a function for each plugin
  t.is(typeof plugins.verifyConditions, 'function');
  t.is(typeof plugins.getLastRelease, 'function');
  t.is(typeof plugins.analyzeCommits, 'function');
  t.is(typeof plugins.verifyRelease, 'function');
  t.is(typeof plugins.generateNotes, 'function');
  t.is(typeof plugins.publish, 'function');
});

test('Export plugins based on config', t => {
  const plugins = getPlugins(
    {
      verifyConditions: ['./test/fixtures/plugin-noop', {path: './test/fixtures/plugin-noop'}],
      getLastRelease: './test/fixtures/plugin-noop',
      analyzeCommits: {path: './test/fixtures/plugin-noop'},
      verifyRelease: () => {},
    },
    {},
    t.context.logger
  );

  // Verify the module returns a function for each plugin
  t.is(typeof plugins.verifyConditions, 'function');
  t.is(typeof plugins.getLastRelease, 'function');
  t.is(typeof plugins.analyzeCommits, 'function');
  t.is(typeof plugins.verifyRelease, 'function');
  t.is(typeof plugins.generateNotes, 'function');
  t.is(typeof plugins.publish, 'function');
});

test.serial('Export plugins loaded from the dependency of a shareable config module', async t => {
  const temp = tempy.directory();
  await copy(
    './test/fixtures/plugin-noop.js',
    path.join(temp, 'node_modules/shareable-config/node_modules/custom-plugin/index.js')
  );
  await outputFile(path.join(temp, 'node_modules/shareable-config/index.js'), '');
  process.chdir(temp);

  const plugins = getPlugins(
    {
      verifyConditions: ['custom-plugin', {path: 'custom-plugin'}],
      getLastRelease: 'custom-plugin',
      analyzeCommits: {path: 'custom-plugin'},
      verifyRelease: () => {},
    },
    {'custom-plugin': 'shareable-config'},
    t.context.logger
  );

  // Verify the module returns a function for each plugin
  t.is(typeof plugins.verifyConditions, 'function');
  t.is(typeof plugins.getLastRelease, 'function');
  t.is(typeof plugins.analyzeCommits, 'function');
  t.is(typeof plugins.verifyRelease, 'function');
  t.is(typeof plugins.generateNotes, 'function');
  t.is(typeof plugins.publish, 'function');
});

test.serial('Export plugins loaded from the dependency of a shareable config file', async t => {
  const temp = tempy.directory();
  await copy('./test/fixtures/plugin-noop.js', path.join(temp, 'plugin/plugin-noop.js'));
  await outputFile(path.join(temp, 'shareable-config.js'), '');
  process.chdir(temp);

  const plugins = getPlugins(
    {
      verifyConditions: ['./plugin/plugin-noop', {path: './plugin/plugin-noop'}],
      getLastRelease: './plugin/plugin-noop',
      analyzeCommits: {path: './plugin/plugin-noop'},
      verifyRelease: () => {},
    },
    {'./plugin/plugin-noop': './shareable-config.js'},
    t.context.logger
  );

  // Verify the module returns a function for each plugin
  t.is(typeof plugins.verifyConditions, 'function');
  t.is(typeof plugins.getLastRelease, 'function');
  t.is(typeof plugins.analyzeCommits, 'function');
  t.is(typeof plugins.verifyRelease, 'function');
  t.is(typeof plugins.generateNotes, 'function');
  t.is(typeof plugins.publish, 'function');
});

test('Use default when only options are passed for a single plugin', t => {
  const plugins = getPlugins({getLastRelease: {}, analyzeCommits: {}}, {}, t.context.logger);

  // Verify the module returns a function for each plugin
  t.is(typeof plugins.getLastRelease, 'function');
  t.is(typeof plugins.analyzeCommits, 'function');
});

test('Merge global options with plugin options', async t => {
  const plugins = getPlugins(
    {
      globalOpt: 'global',
      otherOpt: 'globally-defined',
      getLastRelease: {path: './test/fixtures/plugin-result-config', localOpt: 'local', otherOpt: 'locally-defined'},
    },
    {},
    t.context.logger
  );

  const result = await plugins.getLastRelease();

  t.deepEqual(result.pluginConfig, {localOpt: 'local', globalOpt: 'global', otherOpt: 'locally-defined'});
});

test('Throw an error if plugin configuration is missing a path for plugin pipeline', t => {
  const error = t.throws(() => getPlugins({verifyConditions: {}}, {}, t.context.logger));

  t.is(error.name, 'SemanticReleaseError');
  t.is(error.code, 'EPLUGINCONF');
  t.is(
    error.message,
    'The "verifyConditions" plugin, if defined, must be a single or an array of plugins definition. A plugin definition is either a string or an object with a path property.'
  );
});

test('Throw an error if an array of plugin configuration is missing a path for plugin pipeline', t => {
  const error = t.throws(() =>
    getPlugins({verifyConditions: [{path: '@semantic-release/npm'}, {}]}, {}, t.context.logger)
  );

  t.is(error.name, 'SemanticReleaseError');
  t.is(error.code, 'EPLUGINCONF');
  t.is(
    error.message,
    'The "verifyConditions" plugin, if defined, must be a single or an array of plugins definition. A plugin definition is either a string or an object with a path property.'
  );
});
