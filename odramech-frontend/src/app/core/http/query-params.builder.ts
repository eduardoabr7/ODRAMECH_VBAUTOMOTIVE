/**
 * BUILDER — monta query strings ignorando valores vazios, sem `if` repetido em cada serviço.
 *
 *   QueryParams.create().set('status', s).set('search', q).toString()  // "status=X&search=y"
 */
export class QueryParams {
  private readonly params = new URLSearchParams();

  static create(): QueryParams {
    return new QueryParams();
  }

  set(key: string, value: string | number | boolean | null | undefined): this {
    if (value === null || value === undefined) return this;
    const str = String(value).trim();
    if (str !== '') this.params.set(key, str);
    return this;
  }

  setAll(values: Record<string, string | number | boolean | null | undefined>): this {
    Object.entries(values).forEach(([k, v]) => this.set(k, v));
    return this;
  }

  /** "path?query" — ou só "path" se não houver parâmetros */
  appendTo(path: string): string {
    const qs = this.params.toString();
    return qs ? `${path}?${qs}` : path;
  }

  toString(): string {
    return this.params.toString();
  }
}
