Como personalizar o ícone da aplicação (Electron)

Coloque os arquivos de ícone no diretório `assets/` na raiz do projeto. Recomendações de formatos:

- Windows: `icon.ico` (recomendado 256x256 dentro do .ico)
- macOS: `icon.icns` (recomendado com múltiplos tamanhos)
- Linux: `icon.png` (recomendado 512x512)

main.js já tenta carregar `assets/icon.png`, `assets/icon.ico` ou `assets/icon.icns` se existirem. Para empacotar um portable com um ícone, siga um destes caminhos:

1) Usando electron-builder (recomendado):
   - instale: `npm install --save-dev electron-builder`
   - adicione no `package.json` um campo "build" com a configuração de ícone, por exemplo:

     "build": {
       "appId": "com.seuapp.exemplo",
       "files": ["**/*"],
       "win": { "icon": "assets/icon.ico" },
       "mac": { "icon": "assets/icon.icns" },
       "linux": { "icon": "assets/icon.png" }
     }

   - para gerar um instalador Windows: `npx electron-builder --win`.

2) Usando electron-packager:
   - instale: `npm i -D electron-packager`
   - exemplo de comando para Windows:
     `npx electron-packager . --platform=win32 --arch=x64 --icon=assets/icon.ico`

Observação: arquivos de ícone não são gerados automaticamente pelo build — você precisa fornecer suas próprias imagens/arquivos .ico/.icns/.png.

Se quiser, posso:
- adicionar carregamento automático do `icon` no `main.js` com fallback inteligente (faço agora), ou
- gerar um ícone de exemplo (um PNG simples) e adicioná-lo ao `assets/` para testes locais.
