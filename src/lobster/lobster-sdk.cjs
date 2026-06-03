'use strict';

const core = require('./lobster-core.cjs');

function createLobsterProduct(options = {}) {
  const configInput = Object.assign({}, options.config || {});
  if (options.productId && !configInput.productId) configInput.productId = options.productId;
  const config = core.configureLobsterPair(Object.keys(configInput).length ? configInput : options);
  const memoryOptions = options.memoryOptions || {};
  const modelAdapter = options.modelAdapter || null;

  async function sendMessage(input = {}) {
    const role = input.role || input.audience || 'child';
    const result = await core.runLobsterModelAdapter(Object.assign({}, input, {
      role,
      config: role === 'parent' ? config.parent : config.child,
      memoryOptions
    }), modelAdapter);
    if (input.persistMemory && result.memoryUpdate) {
      const lobsterId = input.lobsterId || result.lobsterId || (role === 'parent' ? config.parent.id : config.child.id);
      const receipt = core.persistLobsterMemory(lobsterId, result.memoryUpdate, memoryOptions);
      return Object.assign({}, result, {
        memoryReceipt: { ok: receipt.ok, factCount: receipt.factCount, rawDialogueStored: false }
      });
    }
    return result;
  }

  function runCapability(input = {}) {
    const role = input.role || input.audience || 'child';
    return core.runLobsterCapability(Object.assign({}, input, {
      role,
      config: role === 'parent' ? config.parent : config.child
    }));
  }

  async function runSession(input = {}) {
    return core.runLobsterFamilySession(Object.assign({}, input, {
      config,
      memoryOptions
    }), modelAdapter);
  }

  function getCapabilities(role = 'all') {
    return core.listLobsterCapabilities(role);
  }

  function loadMemory(lobsterId) {
    return core.loadLobsterMemory(lobsterId, memoryOptions);
  }

  function persistMemory(lobsterId, memoryUpdate = {}) {
    return core.persistLobsterMemory(lobsterId, memoryUpdate, memoryOptions);
  }

  return {
    schema_id: 'lobster_sdk_v1',
    config,
    sendMessage,
    runCapability,
    runSession,
    getCapabilities,
    loadMemory,
    persistMemory
  };
}

module.exports = {
  createLobsterProduct
};
