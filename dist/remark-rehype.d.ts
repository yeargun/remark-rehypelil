export interface Options {
  allowDangerousHtml?: boolean
}

export type Transformer = (tree: unknown, file?: unknown) => unknown

export function remarkRehype(this: unknown, options?: Options): Transformer
export default remarkRehype
