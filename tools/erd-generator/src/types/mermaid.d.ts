declare module 'mermaid' {
  export interface Mermaid {
    initialize: (config: any) => void;
    init: (config: any, element: Element | null) => void;
  }
  const mermaid: Mermaid;
  export default mermaid;
}
