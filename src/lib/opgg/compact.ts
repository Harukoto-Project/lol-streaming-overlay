export type CompactValue =
  | string
  | number
  | boolean
  | null
  | CompactValue[]
  | { [key: string]: CompactValue };

type Schema = Map<string, string[]>;

const CLASS_LINE = /^class\s+([A-Za-z_]\w*)\s*:\s*(.*)$/;
const TOKEN = /[A-Za-z0-9_.+-]/;

export class CompactParseError extends Error {
  constructor(message: string, position?: number) {
    super(position === undefined ? message : `${message} (at ${position})`);
    this.name = "CompactParseError";
  }
}

export function parseCompact(text: string): CompactValue {
  const schema: Schema = new Map();
  const dataLines: string[] = [];

  for (const line of text.split(/\r?\n/)) {
    const match = CLASS_LINE.exec(line);
    if (match) {
      schema.set(
        match[1],
        match[2]
          .split(",")
          .map((field) => field.trim())
          .filter(Boolean),
      );
    } else {
      dataLines.push(line);
    }
  }

  const source = dataLines.join("\n").trim();
  if (!source) {
    throw new CompactParseError("Empty data section");
  }

  const reader = new Reader(source, schema);
  const value = reader.readValue();
  reader.skipWhitespace();
  if (!reader.atEnd()) {
    throw new CompactParseError("Unexpected trailing data", reader.position);
  }
  return value;
}

class Reader {
  position = 0;

  constructor(
    private readonly source: string,
    private readonly schema: Schema,
  ) {}

  atEnd(): boolean {
    return this.position >= this.source.length;
  }

  skipWhitespace(): void {
    while (!this.atEnd() && /\s/.test(this.source[this.position])) {
      this.position += 1;
    }
  }

  readValue(): CompactValue {
    this.skipWhitespace();
    if (this.atEnd()) {
      throw new CompactParseError("Unexpected end of data", this.position);
    }

    const char = this.source[this.position];
    if (char === '"') return this.readString();
    if (char === "[") return this.readList();

    const token = this.readToken();
    if (this.source[this.position] === "(") {
      return this.readObject(token);
    }
    return this.literal(token);
  }

  private readToken(): string {
    const start = this.position;
    while (!this.atEnd() && TOKEN.test(this.source[this.position])) {
      this.position += 1;
    }
    if (start === this.position) {
      throw new CompactParseError(
        `Unexpected character "${this.source[this.position]}"`,
        this.position,
      );
    }
    return this.source.slice(start, this.position);
  }

  private literal(token: string): CompactValue {
    if (token === "null") return null;
    if (token === "true") return true;
    if (token === "false") return false;
    if (/^[+-]?\d/.test(token)) {
      const numeric = Number(token);
      if (!Number.isNaN(numeric)) return numeric;
    }
    return token;
  }

  private readString(): string {
    this.position += 1;
    let result = "";

    while (!this.atEnd()) {
      const char = this.source[this.position];
      this.position += 1;

      if (char === '"') return result;
      if (char !== "\\") {
        result += char;
        continue;
      }

      const escaped = this.source[this.position];
      this.position += 1;
      switch (escaped) {
        case "n":
          result += "\n";
          break;
        case "t":
          result += "\t";
          break;
        case "r":
          result += "\r";
          break;
        case "b":
          result += "\b";
          break;
        case "f":
          result += "\f";
          break;
        case "u": {
          const hex = this.source.slice(this.position, this.position + 4);
          if (!/^[0-9a-fA-F]{4}$/.test(hex)) {
            throw new CompactParseError("Invalid unicode escape", this.position);
          }
          result += String.fromCharCode(parseInt(hex, 16));
          this.position += 4;
          break;
        }
        default:
          result += escaped ?? "";
      }
    }

    throw new CompactParseError("Unterminated string", this.position);
  }

  private readList(): CompactValue[] {
    this.position += 1;
    const items: CompactValue[] = [];

    for (;;) {
      this.skipWhitespace();
      if (this.atEnd()) {
        throw new CompactParseError("Unterminated list", this.position);
      }
      if (this.source[this.position] === "]") {
        this.position += 1;
        return items;
      }

      items.push(this.readValue());
      this.skipWhitespace();
      if (this.source[this.position] === ",") this.position += 1;
    }
  }

  private readObject(className: string): CompactValue {
    this.position += 1;
    const args: CompactValue[] = [];

    for (;;) {
      this.skipWhitespace();
      if (this.atEnd()) {
        throw new CompactParseError(
          `Unterminated ${className}(...)`,
          this.position,
        );
      }
      if (this.source[this.position] === ")") {
        this.position += 1;
        break;
      }

      args.push(this.readValue());
      this.skipWhitespace();
      if (this.source[this.position] === ",") this.position += 1;
    }

    const fields = this.schema.get(className);
    if (!fields) return args;

    const record: { [key: string]: CompactValue } = {};
    fields.forEach((field, index) => {
      record[field] = index < args.length ? args[index] : null;
    });
    return record;
  }
}
