# Recuperação de senha

O login continua usando o nome de usuário. Em **Minha conta → E-mail de recuperação**, cadastre um endereço e confirme sua senha atual. Abra o link recebido e toque em **Confirmar e-mail**. O endereço anterior continua habilitado até a confirmação da troca. Cada endereço confirmado pertence a uma única conta. Contas novas também podem informar o e-mail opcional no cadastro e receber o link de confirmação; contas antigas usam Minha conta. Não atribuímos um e-mail automaticamente a contas existentes.

Na tela de login, **Esqueci minha senha** envia um link ao endereço confirmado. O link expira em 30 minutos e é de uso único. A confirmação de endereço expira em 24 horas. Os links abrem a página web HTTPS, inclusive quando recebidos no celular; a nova senha funciona no site e no aplicativo. Não é preciso instalar o app para redefinir.

O UUID, o planejamento, os cenários e a função da conta são preservados. A redefinição encerra todas as sessões e exige novo login. A resposta pública não informa se o endereço existe ou se está bloqueado. Há limite de cinco solicitações por endereço em 15 minutos e cinco tentativas de cadastro de endereço por conta no mesmo intervalo. O servidor armazena o hash do token, não o link em texto; o segredo fica no fragmento da URL, fora do pedido HTTP e é removido do histórico ao carregar a tela. A confirmação exige ação explícita, para scanners de e-mail não consumirem links ao visitá-los.

## Configuração na EC2

O envio depende de um serviço SMTP real (por exemplo, Amazon SES ou um provedor de e-mail transacional com SMTP). Em `deploy/.env`, preserve as outras variáveis e configure:

```ini
APP_ORIGIN=https://app.75hard.club
SMTP_HOST=smtp.seu-provedor.com
SMTP_PORT=587
SMTP_SECURITY=starttls
SMTP_FROM=remetente@seu-dominio.com
SMTP_USERNAME=usuario-smtp
SMTP_PASSWORD=senha-smtp
```

Use um remetente/endereço autorizado pelo provedor. `SMTP_FROM` aceita somente o endereço, sem nome de exibição. Para TLS implícito, configure `SMTP_SECURITY=ssl` e `SMTP_PORT=465`. Não use porta 25 ou conexão sem TLS. As credenciais SMTP ficam apenas no servidor, nunca no GitHub ou no pacote móvel. Em SES, credenciais SMTP são diferentes da chave de acesso AWS; em sandbox, destinatários também precisam ser verificados. Configure SPF/DKIM conforme o serviço escolhido.

Após atualizar o código e configurar as variáveis:

```bash
cd ~/AppMed
sudo docker compose --env-file deploy/.env -f deploy/compose.prod.yml up -d --build --wait
```

A migração do banco ocorre automaticamente, preservando contas e planejamentos. Sem configuração SMTP, a tela mostra uma mensagem de indisponibilidade, sem simular envio. Falhas no envio em segundo plano geram apenas `recovery_email_delivery_failed` nos logs da API, sem endereço, senha ou link. A resposta HTTP de solicitação não garante entrega: confira sua caixa de entrada/spam e os logs.

## Verificação antes de disponibilizar

1. Entre em uma conta de teste, cadastre seu e-mail e confirme pelo link recebido.
2. Saia e use **Esqueci minha senha**. Confirme a entrega, defina uma senha nova e entre no site e no Android.
3. Confira o planejamento anterior e confirme que sessões antigas não acessam mais a conta.
4. Reutilize o link: deve aparecer inválido/expirado. Teste também um endereço inexistente: a mensagem pública deve ser a mesma.
5. Se esquecer a senha antes de cadastrar/confirmar um e-mail, a recuperação automática não é possível. O suporte não deve redefinir credenciais sem verificar a titularidade.

A entrega real depende do provedor configurado e precisa ser testada na implantação; os testes automatizados usam um transporte simulado.
