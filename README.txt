# 💻 Sistema de Reserva de Equipamentos (PROATI)
> **Escola Maria Olímpia de Souza Queiroz Maciel**

Sistema web em tempo real para gerenciamento, reserva e controle de entrega de notebooks e tablets educacionais para corpo docente e equipe administrativa.

---

## 🚀 Funcionalidades Principais

* ⚡ **Agendamento Rápido:** Reserva simplificada exclusiva para o dia atual com seleção livre de aulas.
* 🗓️ **Calendário Interativo:** Visualização em tempo real das máquinas agendadas por dia e professor responsáve, com detalhamento rápido ao clicar.
* 📦 **Agendamento por Lote:** Permite aos professores realizarem pedidos simultâneos de conjuntos de equipamentos para a turma inteira.
* ➕ **Solicitação de Extras:** Permite anexar até 4 máquinas adicionais por agendamento com justificativa descritiva.
* 🔒 **Segurança & Senhas:** Autenticação restrita a senhas numéricas de exatamente 4 dígitos.
* 🌓 **Modos Claro, Escuro e Automático:** Suporte a preferências visuais personalizadas e com auto-detecção do sistema operacional.
* 📱 **Totalmente Responsivo:** Layout fluido adaptado para telas mobile, tablets e desktops.
* 📊 **Relatórios em CSV:** Exportação mensal detalhada de movimentações para acompanhamento administrativo.

---

## 🛠️ Tecnologias Utilizadas

* **HTML5 / CSS3** (Design responsivo nativo, Flexbox e CSS Grid)
* **JavaScript ES6+** (Vanilla JS sem dependências pesadas de framework)
* **Firebase Firestore** (Banco de dados em tempo real)

---

## 📁 Estrutura de Arquivos

```text
.
├── index.html       # Estrutura principal e contêineres da aplicação
├── styles.css       # Estilização base do projeto
├── app.js           # Lógica do sistema, integração Firestore e validações
└── README.md        # Documentação do projeto