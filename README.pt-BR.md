# Jev Decision Lab

Experimento exploratório de decisões sequenciais com **Jev, da TypeSafe**, pela **Decisions API do OpenRouter**.

[English](README.md) · [Apresentação interativa](docs/index.html) · [Metodologia](docs/methodology.md)

## Executar

Requer Node.js 20 ou superior. Não há dependências externas.

```sh
git clone https://github.com/ronaldoflima/jev-decision-lab.git
cd jev-decision-lab
npm test
npm run dry-run
```

O dry-run não consulta o modelo: segue a rota de referência e conclui três entregas no minuto virtual 28, em onze ações.

Para decisões reais:

```sh
export OPENROUTER_API_KEY='sua-chave'
npm start -- --mode multi
```

A conexão é HTTP direta com OpenRouter, usando fetch nativo. Nenhum serviço pessoal é necessário. Não coloque sua chave nos arquivos do projeto. O Node não carrega .env automaticamente; exporte a variável ou use uma versão compatível com `node --env-file=.env src/run.mjs`. Chamadas reais podem gerar cobrança.

## Cenário e modos

São seis locais, bateria máxima de nove unidades e três entregas com prazos: hospital até 7, loja até 16 e museu até 28. Cada rua gasta tempo e bateria; entregar leva um minuto; recarregar leva três. Uma rua fecha no minuto 12 e o agente só recebe essa informação quando ela é observada.

- `--mode none`: sem desfazer.
- `--mode single`: desfazer a última ação.
- `--mode multi`: opções de desfazer uma, duas ou três ações.

Há três créditos de restauração por episódio. Desfazer N ações gasta N créditos. Tempo, bateria, posição, energia e entregas são restaurados; conhecimento de eventos, número de decisões e custo de API permanecem.

Opções adicionais: `--model`, `--max-decisions`, `--timeout`, `--output` e `--dry-run`. Veja a tabela no README principal.

## Apresentar

Abra `docs/index.html` no navegador. Os HTMLs funcionam offline e não consultam o Jev. Incluem mapa, reprodução das rotas, modo manual, artigo e explicação da API.

Novas execuções são salvas em `results/` e não modificam automaticamente os HTMLs. Os registros guardam pedidos, respostas, probabilidades, confiança, versão e custos. Não há repetição automática em falhas; uma chamada sem resposta pode ter sido cobrada.

## Resultado e limites

As versões sem desfazer e com desfazer único terminaram com duas entregas. A versão com profundidades explícitas concluiu as três no minuto 28, usando dezessete decisões. Ela escolheu desfazer uma ação três vezes; não escolheu desfazer duas ou três de uma vez.

Foi um episódio registrado por configuração, com instruções diferentes e uma referência que conhece o bloqueio futuro. A melhora não isola uma variável e não demonstra confiabilidade geral.

Os registros do conjunto de testes contêm 229 chamadas bem-sucedidas e US$ 0,020591004 de custo reportado. Não é uma conciliação de fatura nem inclui voz, análise ou criação dos artefatos.

Os testes históricos usaram um adaptador HTTP que encaminhava o mesmo contrato. O executor independente foi criado depois; novas execuções podem produzir resultados diferentes.

Projeto independente de Ronaldo Lima, desenvolvido com auxílio do Codex. Código e documentação original sob licença MIT. Fontes e detalhes no [README principal](README.md).
