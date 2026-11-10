import { createContext, useContext, useState, type Dispatch, type ReactNode, type SetStateAction } from 'react';

export type TemplateDraft = { id: string; nome: string; conteudo: string; variaveis_count: number };

type TemporaryTemplates = {
  templates: TemplateDraft[];
  setTemplates: Dispatch<SetStateAction<TemplateDraft[]>>;
};

const TemplatesContext = createContext<TemporaryTemplates | null>(null);

export function TemporaryTemplatesProvider({ children }: { children: ReactNode }) {
  const [templates, setTemplates] = useState<TemplateDraft[]>([]);
  return <TemplatesContext.Provider value={{ templates, setTemplates }}>{children}</TemplatesContext.Provider>;
}

export function useTemporaryTemplates() {
  const context = useContext(TemplatesContext);
  if (!context) throw new Error('Provider de templates temporários não encontrado.');
  return context;
}
