export enum NodeType {
  Element = "element",
  Text = "text",
}

export interface NodeLike {
  type: NodeType;
  toHTML(): string;
}

export class TextNode implements NodeLike {
  readonly type = NodeType.Text;
  constructor(public text: string) {}
  toHTML(): string {
    const esc = this.text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
    return esc;
  }
}

export class ElementNode implements NodeLike {
  readonly type = NodeType.Element;
  constructor(
    public tag: string,
    public children: NodeLike[] = [],
    public attrs: Record<string, string | number | boolean> = {}
  ) {}

  toHTML(): string {
    const attrs = Object.entries(this.attrs)
      .filter(([, v]) => v !== false && v !== undefined && v !== null)
      .map(([k, v]) => (v === true ? k : `${k}="${String(v)}"`))
      .join(" ");
    const open = attrs ? `<${this.tag} ${attrs}>` : `<${this.tag}>`;
    const inner = this.children.map((c) => c.toHTML()).join("");
    return `${open}${inner}</${this.tag}>`;
  }

  append(child: NodeLike): this {
    this.children.push(child);
    return this;
  }
}
