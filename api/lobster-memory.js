import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const lobster = require('../src/lobster/lobster-core.cjs');

function json(status, body) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'cache-control': 'no-store',
      'access-control-allow-origin': '*'
    }
  });
}

async function readBody(req) {
  try {
    return await req.json();
  } catch (_) {
    return {};
  }
}

function urlFor(req) {
  return new URL(req.url || 'https://yuandianzhixue.com/api/lobster-memory');
}

export default async function handler(req) {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'access-control-allow-origin': '*',
        'access-control-allow-methods': 'GET, POST, OPTIONS',
        'access-control-allow-headers': 'content-type'
      }
    });
  }

  if (req.method === 'GET') {
    const url = urlFor(req);
    const lobsterId = url.searchParams.get('lobster_id') || url.searchParams.get('lobsterId') || 'default';
    const baseDir = url.searchParams.get('base_dir') || '';
    const memory = lobster.loadLobsterMemory(lobsterId, baseDir ? { baseDir } : {});
    return json(200, {
      ok: true,
      schema_id: 'lobster_memory_v1',
      lobsterId: memory.lobsterId,
      facts: memory.facts || [],
      counters: memory.counters || {},
      privacy: memory.privacy || { rawDialogueStored: false },
      updatedAt: memory.updatedAt || ''
    });
  }

  if (req.method !== 'POST') {
    return json(405, { ok: false, error: 'method_not_allowed' });
  }

  const body = await readBody(req);
  const lobsterId = body.lobsterId || body.lobster_id || 'default';
  const memoryUpdate = body.memoryUpdate || body.memory_update || {};
  const persisted = lobster.persistLobsterMemory(lobsterId, memoryUpdate, body.memoryOptions || {});
  return json(200, {
    ok: true,
    schema_id: 'lobster_memory_v1',
    lobsterId: persisted.memory.lobsterId,
    factCount: persisted.factCount,
    memory: {
      facts: persisted.memory.facts,
      counters: persisted.memory.counters,
      privacy: persisted.memory.privacy,
      updatedAt: persisted.memory.updatedAt
    }
  });
}
