// Per-request, one-use read-through. Call confirmAndRead only after the atomic
// reservation succeeds. Both reads must finish before the grant can be used.
export function createReservedReads<T>(readRow: (id: string) => Promise<T>) {
  let saved: {id: string; value: T} | null = null;
  return {
    async read(id: string): Promise<T> {
      if (saved?.id === id) { const value = saved.value; saved = null; return value; }
      return readRow(id);
    },
    async confirmAndRead<G>(id: string, confirm: () => Promise<G>): Promise<G> {
      const [grant, value] = await Promise.all([confirm(), readRow(id)]);
      saved = {id, value};
      return grant;
    }
  };
}
