export interface MapNode {
  id: string;
  text: string;
  x: number;
  y: number;
  collapsed: boolean;
  children: MapNode[];
  __markdownKind?: string;
  __markdownLevel?: number;
  __markdownIndent?: number;
  __markdownMarker?: string;
}

export const uid = () => 'n' + Array.from(crypto.getRandomValues(new Uint32Array(4)), n => n.toString(16).padStart(8, '0')).join('');
export const SAFE_ID = /^[A-Za-z0-9_-]+$/;
export const MAX_FILE_BYTES = 5 * 1024 * 1024;

/** Copy and validate untrusted documents before changing the active document. */
export function normalizeRoot(value: unknown): MapNode {
  let count = 0;
  const seen = new WeakSet<object>();
  const walk = (input: unknown, depth: number): MapNode => {
    if (!input || typeof input !== 'object' || Array.isArray(input)) {
      throw new Error('节点必须是对象');
    }
    if (seen.has(input) || depth > 100 || ++count > 5000) {
      throw new Error('脑图超过 5000 个节点、100 层或存在循环');
    }
    seen.add(input);
    const node = input as Record<string, unknown>;
    if (typeof node.text !== 'string' || node.text.length > 20000) {
      throw new Error('节点文字无效或过长');
    }
    if (node.children !== undefined && !Array.isArray(node.children)) {
      throw new Error('子节点必须是数组');
    }
    const result: MapNode = {
      id: typeof node.id === 'string' ? node.id : uid(),
      text: node.text,
      x: typeof node.x === 'number' && Number.isFinite(node.x) ? node.x : 0,
      y: typeof node.y === 'number' && Number.isFinite(node.y) ? node.y : 0,
      collapsed: node.collapsed === true,
      children: (node.children as unknown[] || []).map(child => walk(child, depth + 1)),
    };
    if (['heading', 'list', 'blockquote'].includes(String(node.__markdownKind))) {
      result.__markdownKind = String(node.__markdownKind);
      result.__markdownLevel = Number(node.__markdownLevel) || 0;
      result.__markdownIndent = Number(node.__markdownIndent) || 0;
      result.__markdownMarker = typeof node.__markdownMarker === 'string' ? node.__markdownMarker : '-';
    }
    return result;
  };
  return walk(value, 0);
}

/** Reserve exact matches first, so insertion cannot steal a later sibling's identity. */
export function matchChildren<T extends { text: string }>(next: T[], previous: T[]): (T | null)[] {
  const normalize = (text: string) => text.replace(/\s+/g, ' ').trim();
  const used = new Set<number>();
  const matches = next.map(child => {
    const index = previous.findIndex((old, i) => !used.has(i) && normalize(old.text) === normalize(child.text));
    if (index >= 0) used.add(index);
    return index;
  });
  // Positional rename is only unambiguous when the sibling count is unchanged.
  return matches.map((index, i) => {
    if (index >= 0) return previous[index];
    if (next.length === previous.length && !used.has(i)) {
      used.add(i);
      return previous[i];
    }
    return null;
  });
}

export function writeDocument(storage: Pick<Storage, 'setItem'>, key: string, document: unknown): boolean {
  try {
    storage.setItem(key, JSON.stringify(document));
    return true;
  } catch {
    return false;
  }
}
