// Loads the shared contract data (design S8). Every rule reads §C13 and §C20 from here, so the
// grammar and the patterns are never written twice in code.
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

export const TOOL_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const CONTRACT_PATH = path.join(TOOL_DIR, 'contract', 'backend-contract.json');
export const CASES_PATH = path.join(TOOL_DIR, 'contract', 'cases.json');

export const contract = JSON.parse(readFileSync(CONTRACT_PATH, 'utf8'));
export const KINDS = contract.kinds;
export const TOKEN = contract.token;
export const ONLY_DIRS = contract.onlyDirs;
