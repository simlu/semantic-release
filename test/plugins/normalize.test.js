import test from 'ava';
import {noop} from 'lodash';
import {stub} from 'sinon';
import normalize from '../../lib/plugins/normalize';

test.beforeEach(t => {
  // Stub the logger functions
  t.context.log = stub();
  t.context.logger = {log: t.context.log};
});

test('Normalize and load plugin from string', t => {
  const plugin = normalize('verifyConditions', {}, {}, './test/fixtures/plugin-noop', t.context.logger);

  t.is(typeof plugin, 'function');
  t.deepEqual(t.context.log.args[0], ['Load plugin %s from %s', 'verifyConditions', './test/fixtures/plugin-noop']);
});

test('Normalize and load plugin from object', t => {
  const plugin = normalize('publish', {}, {}, {path: './test/fixtures/plugin-noop'}, t.context.logger);

  t.is(typeof plugin, 'function');
  t.deepEqual(t.context.log.args[0], ['Load plugin %s from %s', 'publish', './test/fixtures/plugin-noop']);
});

test('Normalize and load plugin from a base file path', t => {
  const plugin = normalize(
    'verifyConditions',
    {'./plugin-noop': './test/fixtures'},
    {},
    './plugin-noop',
    t.context.logger
  );

  t.is(typeof plugin, 'function');
  t.deepEqual(t.context.log.args[0], [
    'Load plugin %s from %s in shareable config %s',
    'verifyConditions',
    './plugin-noop',
    './test/fixtures',
  ]);
});

test('Normalize and load plugin from function', t => {
  const plugin = normalize('', {}, {}, () => {}, t.context.logger);

  t.is(typeof plugin, 'function');
});

test('Normalize and load plugin that retuns multiple functions', t => {
  const plugin = normalize('verifyConditions', {}, {}, './test/fixtures/multi-plugin', t.context.logger);

  t.is(typeof plugin, 'function');
  t.deepEqual(t.context.log.args[0], ['Load plugin %s from %s', 'verifyConditions', './test/fixtures/multi-plugin']);
});

test('Wrap plugin in a function that validate the output of the plugin', async t => {
  const pluginFunction = stub().resolves(1);
  const plugin = normalize('', {}, {}, pluginFunction, t.context.logger, {
    validator: output => output === 1,
    message: 'The output must be 1.',
  });

  await t.notThrows(plugin());

  pluginFunction.resolves(2);
  const error = await t.throws(plugin(), Error);
  t.is(error.message, 'The output must be 1. Received: 2');
});

test('Plugin is called with "pluginConfig" (omitting "path", adding global config) and input', async t => {
  const pluginFunction = stub().resolves();
  const conf = {path: pluginFunction, conf: 'confValue'};
  const globalConf = {global: 'globalValue'};
  const plugin = normalize('', {}, globalConf, conf, t.context.logger);
  await plugin('param');

  t.true(pluginFunction.calledWith({conf: 'confValue', global: 'globalValue'}, 'param'));
});

test('Prevent plugins to modify "pluginConfig"', async t => {
  const pluginFunction = stub().callsFake(pluginConfig => {
    pluginConfig.conf.subConf = 'otherConf';
  });
  const conf = {path: pluginFunction, conf: {subConf: 'originalConf'}};
  const globalConf = {globalConf: {globalSubConf: 'originalGlobalConf'}};
  const plugin = normalize('', {}, globalConf, conf, t.context.logger);
  await plugin();

  t.is(conf.conf.subConf, 'originalConf');
  t.is(globalConf.globalConf.globalSubConf, 'originalGlobalConf');
});

test('Prevent plugins to modify its input', async t => {
  const pluginFunction = stub().callsFake((pluginConfig, options) => {
    options.param.subParam = 'otherParam';
  });
  const input = {param: {subParam: 'originalSubParam'}};
  const plugin = normalize('', {}, {}, pluginFunction, t.context.logger);
  await plugin(input);

  t.is(input.param.subParam, 'originalSubParam');
});

test('Return noop if the plugin is not defined', t => {
  const plugin = normalize();

  t.is(plugin, noop);
});

test('Always pass a defined "pluginConfig" for plugin defined with string', async t => {
  // Call the normalize function with the path of a plugin that returns its config
  const plugin = normalize('', {}, {}, './test/fixtures/plugin-result-config', t.context.logger);
  const pluginResult = await plugin();

  t.deepEqual(pluginResult.pluginConfig, {});
});

test('Always pass a defined "pluginConfig" for plugin defined with path', async t => {
  // Call the normalize function with the path of a plugin that returns its config
  const plugin = normalize('', {}, {}, {path: './test/fixtures/plugin-result-config'}, t.context.logger);
  const pluginResult = await plugin();

  t.deepEqual(pluginResult.pluginConfig, {});
});

test('Throws an error if the plugin return an object without the expected plugin function', t => {
  const error = t.throws(() => normalize('inexistantPlugin', {}, {}, './test/fixtures/multi-plugin', t.context.logger));

  t.is(error.code, 'EPLUGINCONF');
  t.is(error.name, 'SemanticReleaseError');
  t.is(
    error.message,
    'The inexistantPlugin plugin must be a function, or an object with a function in the property inexistantPlugin.'
  );
});

test('Throws an error if the plugin is not found', t => {
  const error = t.throws(() => normalize('inexistantPlugin', {}, {}, 'non-existing-path', t.context.logger), Error);

  t.is(error.message, "Cannot find module 'non-existing-path'");
  t.is(error.code, 'MODULE_NOT_FOUND');
});
