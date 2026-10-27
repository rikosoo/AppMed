import {test,expect} from '@playwright/test';
import {accountLogin} from './helpers/auth';
test('forgot password reports configuration errors and uses a generic success message',async({page})=>{
 await page.goto('/');await page.getByRole('button',{name:'Esqueci minha senha',exact:true}).click();
 await page.getByLabel('E-mail de recuperação',{exact:true}).fill('doctor@example.com');
 await page.route('**/api/auth/forgot-password',route=>route.fulfill({status:503,json:{detail:'O envio de e-mails ainda não foi configurado.'}}));
 await page.getByRole('button',{name:'Enviar link de recuperação',exact:true}).click();await expect(page.locator('.recovery-form').getByRole('alert')).toContainText('não foi configurado');
 await page.route('**/api/auth/forgot-password',route=>route.fulfill({json:{message:'Se houver uma conta habilitada com esse e-mail confirmado, enviaremos um link de recuperação.'}}));
 await page.getByRole('button',{name:'Enviar link de recuperação',exact:true}).click();await expect(page.getByRole('status')).toContainText('Se houver uma conta');
 await page.getByRole('button',{name:'Voltar para entrar',exact:true}).click();await expect(page.getByRole('heading',{name:'Entre no seu espaço.'})).toBeVisible();
});

test('reset link stays out of requests, validates passwords and is usable on narrow screens',async({page})=>{
 const token='a'.repeat(43);let body:any;
 await page.route('**/api/auth/reset-password',async route=>{body=route.request().postDataJSON();await route.fulfill({json:{message:'Senha alterada. Entre novamente com seu usuário e a nova senha.'}});});
 await page.goto(`/recuperar-senha#reset=${token}`);await expect(page.getByRole('heading',{name:'Escolha sua nova senha'})).toBeVisible();await expect(page).toHaveURL(/\/recuperar-senha$/);
 await page.setViewportSize({width:320,height:568});
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBeTruthy();
 await page.getByLabel('Nova senha',{exact:true}).fill('Updated-password-123!');await page.getByLabel('Confirmar nova senha',{exact:true}).fill('Mismatched-password');
 await page.getByRole('button',{name:'Salvar nova senha',exact:true}).click();await expect(page.locator('.recovery-form').getByRole('alert')).toContainText('não coincidem');expect(body).toBeUndefined();
 await page.getByLabel('Confirmar nova senha',{exact:true}).fill('Updated-password-123!');await page.getByRole('button',{name:'Salvar nova senha',exact:true}).click();
 await expect(page.getByRole('status')).toContainText('Senha alterada');expect(body).toEqual({token,new_password:'Updated-password-123!'});
});

test('email confirmation requires an explicit action and handles expired links',async({page})=>{
 let calls=0;await page.route('**/api/auth/confirm-email',async route=>{calls++;await route.fulfill({status:400,json:{detail:'Link inválido ou expirado. Solicite um novo link.'}});});
 await page.goto(`/recuperar-senha#verify=${'b'.repeat(43)}`);await expect(page.getByRole('heading',{name:'Confirme seu e-mail'})).toBeVisible();expect(calls).toBe(0);
 await page.getByRole('button',{name:'Confirmar e-mail',exact:true}).click();await expect(page.locator('.recovery-form').getByRole('alert')).toContainText('expirado');expect(calls).toBe(1);
 await expect(page.getByText('Para reenviar a confirmação, entre e cadastre o e-mail novamente em Minha conta.')).toBeVisible();await page.getByRole('button',{name:'Voltar para entrar',exact:true}).click();await expect(page.getByRole('heading',{name:'Entre no seu espaço.'})).toBeVisible();
});

test('existing accounts can register a recovery email with their current password',async({page})=>{
 await page.goto('/');await accountLogin(page);
 await page.route('**/api/auth/recovery-email',route=>route.request().method()==='GET'?route.fulfill({json:{email:null}}):route.fulfill({json:{message:'Enviamos um link para confirmar o e-mail.'}}));
 await page.getByRole('button',{name:'Minha conta',exact:true}).click();await page.getByRole('button',{name:'Cadastrar e-mail',exact:true}).click();
 await page.getByLabel('E-mail de recuperação',{exact:true}).fill('doctor@example.com');await page.getByLabel('Senha atual para confirmar e-mail',{exact:true}).fill('Financial-tests-123!');
 const request=page.waitForRequest(request=>request.url().endsWith('/auth/recovery-email')&&request.method()==='POST');await page.getByRole('button',{name:'Enviar confirmação',exact:true}).click();
 expect((await request).postDataJSON()).toEqual({email:'doctor@example.com',current_password:'Financial-tests-123!'});
 await expect(page.getByRole('status')).toContainText('Enviamos um link');
});
