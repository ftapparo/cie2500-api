export function fromNodeBufferLike(obj: any): Buffer | undefined {
  if (obj && obj.type === 'Buffer' && Array.isArray(obj.data)) {
    return Buffer.from(obj.data);
  }
  return undefined;
}

export function trimNulls(s: string): string {
  return s.replace(/\x00+$/g, '');
}

/** Fila simples para serializar requisições ao daemon */
export class RequestQueue {
  private last: Promise<any> = Promise.resolve();

  run<T>(task: () => Promise<T>): Promise<T> {
    const next = this.last.then(task, task);
    // não deixe a cadeia “quebrar”
    this.last = next.catch(() => {});
    return next;
  }
}
