export type EditorSnapshot = {
  version: number;
  layoutVersion?: number;
  markdownFormatVersion?: number;
  root: Record<string, unknown>;
  links: Array<Record<string, unknown>>;
  markdownText?: string;
  markdownLastValidText?: string;
  mode?: 'map' | 'markdown' | 'split';
  viewport?: { x: number; y: number; scale: number };
  theme?: 'light' | 'dark';
};

export type MindMapDocument = {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  deletedAt: string | null;
  nodeCount: number;
  content: EditorSnapshot;
};

const DB_NAME = 'inkmap-library';
const DB_VERSION = 1;
const STORE_NAME = 'documents';
export const LEGACY_STORAGE_KEY = 'mindmap-studio-v2';

function createId() {
  return typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `doc-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

function titleFromSnapshot(snapshot: EditorSnapshot) {
  const title = typeof snapshot.root?.text === 'string' ? snapshot.root.text.trim() : '';
  return !title || title === '中心主题' ? '未命名脑图' : title;
}

function countNodes(node: unknown): number {
  if (!node || typeof node !== 'object') return 0;
  const children = Array.isArray((node as { children?: unknown[] }).children)
    ? (node as { children: unknown[] }).children
    : [];
  return 1 + children.reduce<number>((total, child) => total + countNodes(child), 0);
}

export function createBlankSnapshot(title = '未命名脑图'): EditorSnapshot {
  const rootTitle = title === '未命名脑图' ? '中心主题' : title;
  return {
    version: 2,
    layoutVersion: 2,
    markdownFormatVersion: 2,
    root: {
      id: `n${Math.random().toString(36).slice(2, 10)}`,
      text: rootTitle,
      x: 0,
      y: 0,
      children: [],
      collapsed: false,
    },
    links: [],
    markdownText: `# ${rootTitle}`,
    markdownLastValidText: `# ${rootTitle}`,
    mode: 'map',
    theme: 'dark',
  };
}

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        store.createIndex('updatedAt', 'updatedAt');
        store.createIndex('deletedAt', 'deletedAt');
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('无法打开本地文档库'));
  });
}

function requestResult<T>(request: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('本地文档操作失败'));
  });
}

async function withStore<T>(mode: IDBTransactionMode, run: (store: IDBObjectStore) => IDBRequest<T>) {
  const db = await openDatabase();
  try {
    const transaction = db.transaction(STORE_NAME, mode);
    const completed = new Promise<void>((resolve, reject) => {
      transaction.oncomplete = () => resolve();
      transaction.onabort = () => reject(transaction.error || new Error('本地文档事务未完成'));
      transaction.onerror = () => reject(transaction.error || new Error('本地文档写入失败'));
    });
    const [result] = await Promise.all([requestResult(run(transaction.objectStore(STORE_NAME))), completed]);
    return result;
  } finally {
    db.close();
  }
}

export async function listDocuments(includeDeleted = false): Promise<MindMapDocument[]> {
  const records = await withStore('readonly', (store) => store.getAll()) as MindMapDocument[];
  return records
    .filter((record) => includeDeleted ? Boolean(record.deletedAt) : !record.deletedAt)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export async function getDocument(id: string) {
  return await withStore('readonly', (store) => store.get(id)) as MindMapDocument | undefined;
}

export async function saveDocument(id: string, snapshot: EditorSnapshot) {
  const existing = await getDocument(id);
  const now = new Date().toISOString();
  const record: MindMapDocument = {
    id,
    title: titleFromSnapshot(snapshot),
    createdAt: existing?.createdAt || now,
    updatedAt: now,
    deletedAt: existing?.deletedAt || null,
    nodeCount: countNodes(snapshot.root),
    content: structuredClone(snapshot),
  };
  await withStore('readwrite', (store) => store.put(record));
  return record;
}

export async function createDocument(title = '未命名脑图', snapshot = createBlankSnapshot(title)) {
  return saveDocument(createId(), snapshot);
}

export async function duplicateDocument(id: string) {
  const source = await getDocument(id);
  if (!source) throw new Error('找不到要复制的文档');
  const snapshot = structuredClone(source.content);
  if (snapshot.root) snapshot.root.text = `${source.title} 副本`;
  return createDocument(`${source.title} 副本`, snapshot);
}

export async function moveDocumentToTrash(id: string) {
  const record = await getDocument(id);
  if (!record) return;
  record.deletedAt = new Date().toISOString();
  record.updatedAt = record.deletedAt;
  await withStore('readwrite', (store) => store.put(record));
}

export async function restoreDocument(id: string) {
  const record = await getDocument(id);
  if (!record) return;
  record.deletedAt = null;
  record.updatedAt = new Date().toISOString();
  await withStore('readwrite', (store) => store.put(record));
}

export async function migrateLegacyDocument() {
  const active = await listDocuments(false);
  const deleted = await listDocuments(true);
  if (active.length || deleted.length) return active;
  const raw = localStorage.getItem(LEGACY_STORAGE_KEY) || localStorage.getItem('mindmap-studio-v1');
  if (!raw) return [];
  try {
    const snapshot = JSON.parse(raw) as EditorSnapshot;
    if (!snapshot.root) return [];
    return [await createDocument(titleFromSnapshot(snapshot), snapshot)];
  } catch {
    return [];
  }
}
