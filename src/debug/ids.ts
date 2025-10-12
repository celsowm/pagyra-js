let seq = 1;
export type UID = number;
export function newId(): UID { return seq++; }

export const DomIds = new WeakMap<object, UID>();
export const RenderIds = new WeakMap<object, UID>();
export const LayoutIds = new WeakMap<object, UID>();

export function ensureId<T extends object>(map: WeakMap<object, UID>, node: T): UID {
  let id = map.get(node);
  if (!id) { id = newId(); map.set(node, id); }
  return id;
}
