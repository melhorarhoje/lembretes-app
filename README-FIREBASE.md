Firestore: Regras e deploy (guia rápido)

ATENÇÃO: permissões abertas permitem que qualquer pessoa leia/grave dados no seu banco.
Use apenas temporariamente para depuração e reverta para regras seguras em seguida.

1) Requisitos
- Ter o Firebase CLI instalado (npm i -g firebase-tools)
- Estar autenticado com a conta que tem acesso ao projeto: `firebase login`
- Ter o projeto Firebase configurado localmente: `firebase use --add` (selecionar o projeto)

2) Arquivo de regras local
- Já existe `firestore.rules` neste repositório com regras permissivas (apenas para teste).

3) Como aplicar (deploy) as regras
- No diretório do projeto execute:

```bash
firebase deploy --only firestore:rules --project <SEU_PROJECT_ID>
```

- Substitua `<SEU_PROJECT_ID>` pelo ID do projeto Firebase (por exemplo `compi-reminder`).

4) Como reverter
- Depois do teste, restaure regras mais restritivas (ex: requer autenticação):

Exemplo de regras seguras (requer autenticação para leitura/escrita na coleção):

```text
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /lembretesCompartilhados/{docId} {
      allow read, write: if request.auth != null;
    }
    match /{document=**} {
      allow read, write: if false;
    }
  }
}
```

- Para aplicar novamente:

```bash
firebase deploy --only firestore:rules --project <SEU_PROJECT_ID>
```

5) Logs e diagnóstico
- Se o app ainda não conectar em tempo real, verifique:
  - Regras do Firestore (console.firebase.google.com > Firestore > Rules)
  - Se o SDK está inicializando com as credenciais corretas (appId, apiKey);
  - Console do processo principal (logs do Electron) para mensagens do Firestore.

Se quiser, posso:
- Gerar um arquivo de regras mais restritivo já pronto para deploy;
- Ajudar a executar os comandos de deploy se você me der permissão (ou rodar localmente e me enviar o resultado dos logs);
- Implementar uma checagem na aplicação para detectar erros de permissão e mostrar instruções in-app.
