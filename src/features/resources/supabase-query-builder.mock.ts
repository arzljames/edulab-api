/**
 * Test-only helper for mocking the chainable supabase-js query builder
 * (`.from(table).select().eq()...`) used throughout the resources feature's
 * services. Real supabase-js query builders are themselves `PromiseLike`,
 * so callers can either terminate a chain explicitly with `.single()` /
 * `.maybeSingle()`, or simply `await` the builder after the last filter
 * call (e.g. `await builder.order(...).range(...)`). This mock supports
 * both styles: every chain method returns the same builder instance, and
 * the builder resolves to the configured `{ data, error }` result whether
 * it's awaited directly or terminated with `.single()`/`.maybeSingle()`.
 *
 * Not used by application code — only by `.spec.ts` files in this feature.
 */

export interface SupabaseMockResult<T> {
  data: T | null;
  error: { message: string; code?: string } | null;
}

export interface QueryBuilderMock<T = unknown> {
  select: jest.Mock<QueryBuilderMock<T>, unknown[]>;
  insert: jest.Mock<QueryBuilderMock<T>, unknown[]>;
  update: jest.Mock<QueryBuilderMock<T>, unknown[]>;
  delete: jest.Mock<QueryBuilderMock<T>, unknown[]>;
  upsert: jest.Mock<QueryBuilderMock<T>, unknown[]>;
  eq: jest.Mock<QueryBuilderMock<T>, unknown[]>;
  in: jest.Mock<QueryBuilderMock<T>, unknown[]>;
  order: jest.Mock<QueryBuilderMock<T>, unknown[]>;
  range: jest.Mock<QueryBuilderMock<T>, unknown[]>;
  maybeSingle: jest.Mock<Promise<SupabaseMockResult<T>>, unknown[]>;
  single: jest.Mock<Promise<SupabaseMockResult<T>>, unknown[]>;
  then: <TResult1 = SupabaseMockResult<T>, TResult2 = never>(
    onFulfilled?:
      | ((value: SupabaseMockResult<T>) => TResult1 | PromiseLike<TResult1>)
      | null,
    onRejected?: ((reason: unknown) => TResult2 | PromiseLike<TResult2>) | null,
  ) => Promise<TResult1 | TResult2>;
}

export function createQueryBuilder<T>(
  result: SupabaseMockResult<T>,
): QueryBuilderMock<T> {
  const builder = {} as QueryBuilderMock<T>;

  const chainMethods = [
    'select',
    'insert',
    'update',
    'delete',
    'upsert',
    'eq',
    'in',
    'order',
    'range',
  ] as const;

  for (const method of chainMethods) {
    builder[method] = jest.fn(() => builder);
  }

  builder.maybeSingle = jest.fn().mockResolvedValue(result);
  builder.single = jest.fn().mockResolvedValue(result);
  // Intentional: mirrors supabase-js's real query builder, which is itself
  // PromiseLike so a chain can be awaited directly without an explicit
  // terminal call.
  // eslint-disable-next-line unicorn/no-thenable
  builder.then = (onFulfilled, onRejected) =>
    Promise.resolve(result).then(onFulfilled, onRejected);

  return builder;
}

export function createSupabaseMock(): { from: jest.Mock } {
  return { from: jest.fn() };
}
