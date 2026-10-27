'use client';
import MoneyInput from '@/components/money-input';
import { useState } from 'react';
import { currency, cents, type Work } from '@/lib/model';
import { afterTax, type TaxRegime } from '@/lib/finance';
export default function WorkTaxFields({ work }: { work?: Work | null }) {
  const legacy = !!work && !work.tax_regime;
  const [regime, setRegime] = useState<TaxRegime | 'legacy' | ''>(work?.tax_regime || (legacy ? 'legacy' : ''));
  const [value, setValue] = useState(work ? String((work.gross_cents ?? work.net_cents)/100) : '');
  const calculated = Number.isFinite(cents(value)) && (regime === 'PF' || regime === 'PJ' ) ? afterTax(cents(value), regime as TaxRegime) : null;
  return <div className="tax-fields">
    <label>Forma de recebimento<select aria-label="Forma de recebimento" name="tax_regime" required value={regime} onChange={e=>{if(regime==='legacy')setValue('');setRegime(e.target.value as TaxRegime | 'legacy');}}>
      <option value="" disabled>Selecione PF ou PJ</option>
      {legacy&&<option value="legacy">Valor líquido já cadastrado (anterior)</option>}
      <option value="PF">Pessoa Física (PF) · estimativa de 27%</option>
      <option value="PJ">Pessoa Jurídica (PJ) · estimativa de 15%</option>
    </select></label>
    <label>{regime==='legacy'?'Ganho líquido / unidade (R$)':'Valor bruto por unidade (R$)'}<MoneyInput aria-label={regime==='legacy'?'Ganho líquido / unidade (R$)':'Valor bruto por unidade (R$)'} name="value" max={1000000} required placeholder="Ex.: 1.500,00" value={value} onChange={e=>setValue(e.target.value)}/></label>
    {calculated&&value&&<div className="tax-preview" aria-live="polite"><span>Imposto estimado ({regime==='PF'?'27':'15'}%): <strong>{currency(calculated.tax_cents)}</strong></span><span>Líquido estimado por unidade: <strong>{currency(calculated.net_cents)}</strong></span></div>}
    <p className="form-hint">{regime==='legacy'?'Este cadastro anterior já contém um valor líquido. Ele será mantido sem novo desconto. Para simular PF/PJ, selecione o regime e informe o valor bruto.':'Desconto fixo de simulação: PF 27% ou PJ 15%. Não é apuração fiscal oficial. Registre custos adicionais na aba Despesas, sem repetir impostos já descontados.'}</p>
  </div>;
}
