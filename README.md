# Magictemplate

Aplicativo inteligente para criação e adaptação de mensagens utilizando templates com textos fixos e variáveis.

## Objetivo

Transformar ideias e mensagens em complementos inteligentes para templates, com análise contextual, construção gramatical e auditoria de qualidade.

## Interface atual

- `/`: Gerar Mensagem, com entrada de ideia ou mensagem, seleção de template temporário e preenchimento manual dos complementos. Cada complemento possui edição e cópia individual.
- `/templates`: criação, edição, busca, importação JSON e exclusão de templates temporários, com modais de edição e confirmação.
- `/configuracoes`: tela de preferências futuras.

O processamento automático permanece desativado. Não há integração de IA ou geração de respostas simuladas. Templates ficam apenas na memória durante a navegação e são descartados ao recarregar ou fechar a aplicação. Complementos manuais são descartados ao trocar o template ou sair da tela Gerar Mensagem. Esta interface não lê nem grava templates no banco conectado e não altera migrações ou políticas.

## Base executável

React 18, TypeScript, Vite 6, Tailwind CSS 3 e TanStack Router com rotas baseadas em arquivos. Utilizar Node.js 22 LTS e npm.

```sh
npm install
npm run dev
```

O Vite informa a URL de desenvolvimento. O plugin do TanStack Router gera `src/routeTree.gen.ts` automaticamente ao iniciar o desenvolvimento ou executar o build. Esse arquivo não deve ser editado manualmente.

```sh
npm run build
npm run preview
```

O build gera as rotas, compila os assets em `dist` e verifica o TypeScript. Só considerar o build aprovado se o comando completo terminar com código zero. O preview serve o conteúdo de `dist`; só deve ser usado após um build bem-sucedido. O servidor de produção deve encaminhar acessos às rotas da aplicação para `index.html`.

## Validação pendente

Não há resultado de execução de build ou preview registrado nesta entrega. A branch do repositório também não foi confirmada nos dados fornecidos.

Após executar o build e iniciar o preview, verificar:

1. Abrir `/`, `/templates` e `/configuracoes`, navegar pelo menu e testar voltar/avançar do navegador.
2. Adicionar um template com `{{1}}` e `{{2}}`, editar, buscar e testar cancelamento e confirmação de exclusão.
3. Verificar foco, tecla Escape e retorno do foco nos modais.
4. Importar um JSON válido e testar mensagens para JSON inválido, conteúdo vazio e arquivo maior que 1 MB.
5. Selecionar um template em Gerar Mensagem, preencher dois complementos diferentes e copiar cada um individualmente. A cópia depende de contexto seguro (HTTPS ou localhost) e permissão do navegador; em caso de falha, a interface orienta cópia manual.
6. Confirmar que os templates sobrevivem à navegação, mas desaparecem ao recarregar, sem gravação no banco.
7. Confirmar layout responsivo e que Processar permanece desativado, sem resultados artificiais.
