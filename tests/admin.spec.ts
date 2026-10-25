import { test, expect } from '@playwright/test';
import { execFileSync } from 'node:child_process';
import { accountLogin } from './helpers/auth';

test('regular accounts cannot access admin data',async({page})=>{
 await page.goto('/admin');await accountLogin(page);
 await expect(page.getByRole('heading',{name:'Acesso restrito'})).toBeVisible();
 expect((await page.request.get('/api/admin/metrics')).status()).toBe(403);
 expect((await page.request.get('/api/admin/users')).status()).toBe(403);
 await expect(page.getByText('Usuários totais',{exact:true})).toHaveCount(0);
});

test('admin searches and blocks users with confirmation at mobile widths',async({page,context})=>{
 await page.goto('/admin');await accountLogin(page);
 const me=await (await page.request.get('/api/auth/me')).json();
 // Promote only this local fixture through the same server-only CLI used in deployment.
 execFileSync('.venv/bin/python',['services/api/manage_admin.py',me.user.username],{cwd:process.cwd()});
 const username=`member-${crypto.randomUUID()}`;const password='Admin-test-password-123';
 const other=await context.browser()!.newContext();
 try{
  expect((await other.request.post('http://127.0.0.1:3000/api/auth/register',{data:{username,password}})).status()).toBe(201);
  await page.reload();await expect(page.getByRole('heading',{name:'Visão do aplicativo'})).toBeVisible();
  await expect(page.getByText('Usuários totais',{exact:true})).toBeVisible();
  await page.getByLabel('Buscar usuário').fill(username);await page.getByRole('button',{name:'Buscar',exact:true}).click();
  const row=page.locator('.admin-user').filter({hasText:username});await expect(row).toHaveCount(1);
  await row.getByRole('button',{name:'Bloquear',exact:true}).click();
  await page.getByRole('button',{name:'Cancelar',exact:true}).click();
  expect((await other.request.get('http://127.0.0.1:3000/api/plan')).status()).toBe(200);
  await row.getByRole('button',{name:'Bloquear',exact:true}).click();await page.getByRole('button',{name:'Confirmar',exact:true}).click();
  await expect(row.getByText('Bloqueada',{exact:true})).toBeVisible();
  expect((await other.request.get('http://127.0.0.1:3000/api/plan')).status()).toBe(401);
  await row.getByRole('button',{name:'Desbloquear',exact:true}).click();await page.getByRole('button',{name:'Confirmar',exact:true}).click();
  await expect(row.getByText('Habilitada',{exact:true})).toBeVisible();
  await page.setViewportSize({width:320,height:800});
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBeTruthy();
  await page.getByLabel('Buscar usuário').fill(`missing-${crypto.randomUUID()}`);await page.getByRole('button',{name:'Buscar',exact:true}).click();
  await expect(page.getByText('Nenhum usuário encontrado.')).toBeVisible();
 }finally{await other.close();}
});
