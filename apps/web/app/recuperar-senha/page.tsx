'use client';
import PasswordRecovery from '@/components/password-recovery';
export default function RecoveryPage(){return <main className="recovery-shell"><PasswordRecovery onBack={()=>location.assign('/')}/></main>;}
