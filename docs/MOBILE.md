# Axterix Med — Android e iOS (etapa 3)

A interface é compilada pelo Vite e empacotada nos projetos Capacitor. Não utiliza `server.url`, iframe ou carregamento remoto da interface. O backend Next/FastAPI continua na EC2; o aplicativo chama os mesmos endpoints por HTTPS pelo transporte HTTP nativo do Capacitor, com cookies de sessão. Não há senha, token ou credencial embutidos no pacote. Uma conta criada no site usa os mesmos dados no aplicativo; é necessário entrar em cada dispositivo.

## Preparar

Na raiz do repositório, com Node.js 22.12 ou superior:

```bash
npm ci
npm run mobile:sync
```

O comando compila a interface e sincroniza os plugins/assets nos dois projetos. Depois de alterar código da interface ou dependências, execute-o novamente. Não é necessário instalar Python no computador só para compilar o aplicativo: ele usa a API da EC2.

A origem padrão é `https://app.75hard.club`. Para trocar antes de compilar, no PowerShell:

```powershell
$env:FINANCEMED_API_ORIGIN="https://novo.seudominio.com"
npm run mobile:sync
```

No Linux/macOS:

```bash
FINANCEMED_API_ORIGIN=https://novo.seudominio.com npm run mobile:sync
```

Use somente a origem HTTPS, sem `/admin`, credenciais ou parâmetros. Essa variável é de compilação, não vai no `deploy/.env` da EC2. Para trocar de domínio depois da distribuição é preciso gerar e distribuir uma nova versão; preserve o endereço antigo durante a transição. O ID provisório dos projetos é `club.hard75.financemed`; confirme o identificador antes da primeira publicação, pois trocar após publicar cria outro aplicativo.

## Atualizar o servidor antes de testar

A proteção externa Basic Auth foi retirada do Caddy: a janela de usuário/senha do navegador não funciona no transporte nativo. O login próprio do Axterix Med continua obrigatório para dados, cálculos e administração; o cadastro está disponível publicamente. As variáveis BASIC_AUTH antigas podem permanecer no `.env`, mas deixam de ser utilizadas. Não inclua essas credenciais no aplicativo.

No SSH da EC2, após o commit estar disponível:

```bash
cd ~/AppMed
git pull --ff-only origin main
sudo docker compose --env-file deploy/.env -f deploy/compose.prod.yml build
sudo docker compose --env-file deploy/.env -f deploy/compose.prod.yml up -d --wait --wait-timeout 180
```

Mantenha uma única linha para cada variável:

```env
APP_DOMAIN=app.75hard.club
APP_ORIGIN=https://app.75hard.club
```

Não coloque `APP_DOMAIN=:80`. Certificado válido é obrigatório, sem exceções TLS ou HTTP liberado. Não precisa abrir portas adicionais. Não alteramos CORS para aceitar qualquer origem; as chamadas web continuam no próprio domínio e as chamadas nativas usam a API autenticada.

## Android no Windows, Linux ou macOS

Instale Android Studio, SDK Android 36 e JDK 21 (pode usar o JDK compatível do Android Studio). Depois:

```bash
npm run mobile:android
```

O Android Studio abre `apps/mobile/android`. Aguarde a sincronização do Gradle, selecione um emulador ou celular com depuração USB e clique em Run. Para um APK de teste, use **Build → Generate App Bundles or APKs → Generate APKs** (o texto varia por versão). O APK debug fica em `apps/mobile/android/app/build/outputs/apk/debug/app-debug.apk`.

Para a Play Store será necessário gerar um **AAB de release assinado**, com chave protegida e incremento de versionCode; isso é parte das próximas etapas. Não envie chaves ou senhas ao GitHub.

## iOS no Mac

É necessário macOS, Xcode compatível com Capacitor 8 e SDK iOS instalado. O projeto usa Swift Package Manager, sem instalação de CocoaPods.

```bash
npm run mobile:ios
```

No Xcode, selecione o time em Signing & Capabilities e escolha simulador/iPhone. Execute Run. A publicação exige conta Apple Developer e um Archive assinado; gerar o projeto no Linux não gera IPA nem valida sua compilação no Xcode.

## Funcionalidades nativas preparadas

- Interface local, cinco telas e assistente de configuração compartilhados com a web.
- HTTP nativo para login e dados; mantém a sessão por cookie, sem tokens no localStorage.
- Áreas seguras, aviso de conexão, retomada do aplicativo e botão Voltar no Android.
- Exportação JSON abre a folha nativa de compartilhamento. O arquivo fica em cache privado do aplicativo; ao compartilhá-lo, o usuário escolhe seu destino. Não concedemos acesso geral ao armazenamento externo.
- Links HTTPS externos, incluindo o painel administrativo, abrem o navegador do sistema. O navegador tem sessão independente: talvez seja necessário entrar novamente.
- Backup automático Android desativado; tráfego HTTP e conteúdo misto desativados.
- Manifesto de privacidade iOS para o acesso a arquivos do plugin Filesystem, incorporado aos recursos do target.

Sem rede, a interface abre e mostra o estado de conexão, mas entrar e carregar dados do servidor exigem internet. Não prometemos funcionamento financeiro completo offline. Alterações ainda não confirmadas continuam no mecanismo existente de cópia pendente por conta.

## Verificação antes da distribuição

A compilação da interface e os testes com ponte nativa simulada não substituem testes em aparelhos. Verificar nos dois sistemas: cadastro/login, persistência da sessão após fechar/reabrir, logout, separação de contas, conexão interrompida, exportação, teclado, áreas seguras, botão Voltar e links externos. O comportamento real do cookie nativo deve ser validado no Android/iPhone com o servidor HTTPS atualizado.

Esta etapa não publica nas lojas. Ícones/splash, páginas públicas de privacidade/suporte e exclusão de conta já estão preparados. Ainda precisamos revisar as declarações das lojas, gerar builds assinados e testar em aparelhos. Consulte [STORE-READINESS.md](STORE-READINESS.md). O manifesto de APIs do iOS não substitui as declarações de dados no App Store Connect. A aprovação depende da avaliação de cada loja.

## Horas por unidade

O campo de trabalho usa **horas decimais**, com ponto ou vírgula: `0.5`/`0,5` = 30 minutos; `1.5`/`1,5` = 1h30; `0.3`/`0,3` = 18 minutos; `0,75` = 45 minutos. O limite é 360h. A confirmação ao lado do campo mostra o tempo interpretado, arredondado ao minuto mais próximo. Isso não reinterpreta trabalhos já salvos: o banco continua guardando minutos inteiros. Ao editar, a conversão para horas decimais preserva o tempo salvo.

No primeiro teste em Android, entre com sua conta, cadastre uma atividade de `0.5`, conclua o planejamento e reabra a edição: o campo deve mostrar `0,5`. Edite para `1,5`, salve, feche/reabra o aplicativo e confirme o valor. Teste também o botão Voltar, a exportação JSON e a retomada após desconectar/reconectar a rede. Se houver falha de compilação, copie o primeiro erro da aba Build; se abrir mas o login falhar, informe a mensagem exibida no aplicativo.

O seletor ao lado do tempo por unidade permite usar horas decimais ou minutos inteiros. Trocar a unidade preserva o tempo interpretado, e o servidor continua recebendo minutos inteiros. A disponibilidade mensal mostra três referências: 8h × 5 dias × 4 semanas = 160h; 12h × 5 dias × 4 semanas = 240h; escala 12×36 ≈ 180h em 30 dias. São referências e não alteram automaticamente a disponibilidade informada.

O avatar com a inicial do usuário e o perfil lateral abrem o mesmo painel Minha conta. O usuário pode alterar o nome de login ou a senha mediante a senha atual; a alteração preserva o UUID e os planejamentos, renova a sessão atual e encerra outras sessões. A recuperação por e-mail confirmado é descrita em [PASSWORD-RECOVERY.md](PASSWORD-RECOVERY.md). Depois de alterar o nome, use o novo login no site e no aplicativo.

Auditoria de responsividade (27/10/2026): testes em Chromium nas larguras 320, 360, 375, 390, 414, 600, 767, 768, 820, 1023, 1024, 1280, 1440, 1920 e 2560px. Cobrem login, cadastro, início da configuração, cinco telas do planejamento, cenários e formulário de trabalho. Conta, cadastro e páginas públicas também foram verificados em alturas reduzidas, incluindo 390×400 e 844×390; os testes confirmam acesso aos botões por rolagem e contenção dos diálogos. O painel administrativo verifica gráficos e tabelas até 2560px. O pacote móvel testa Android/iOS com ponte nativa simulada em telefone, paisagem e tablet. Não substitui teste em Safari/iPhone ou Android reais, teclado nativo e áreas seguras do dispositivo. Executar com os servidores locais ativos: `npx playwright test tests/responsive.spec.ts tests/admin.spec.ts tests/profile.spec.ts tests/overtime.spec.ts --workers=2`; com o preview móvel ativo, `npm run test:native`.

Em telas menores que 1024px, os resultados ficam em duas faixas horizontais independentes: cenários dentro dos limites e cenários com limites a revisar. Deslize para comparar; parte do próximo cartão permanece visível. No desktop, as faixas voltam ao formato de grade. A página mantém rolagem vertical e as faixas também podem receber foco pelo teclado.

O tipo Serviço mensal usa o valor bruto mensal, o regime PF/PJ e as horas totais do trabalho no mês. Conta uma vez na renda e nas horas previstas, sem unidades extras. Nos demais trabalhos, desmarcar “Posso fazer unidades extras deste trabalho” salva o limite em zero: a renda prevista continua entrando, mas o trabalho fica excluído das sugestões adicionais normais e ampliadas. O limite zero informado manualmente tem o mesmo efeito.

## Nome do aplicativo

O nome exibido é **Axterix Med** no Android, iOS, site e instalação pelo navegador. Os identificadores técnicos anteriores (`club.hard75.financemed`, chaves locais, cookies, cabeçalhos e nomes de volumes) permanecem para manter atualizações e dados compatíveis. Não renomeie os volumes ou o arquivo SQLite para aplicar a nova marca. A variável `FINANCEMED_API_ORIGIN` continua válida e o domínio atual permanece o mesmo.
