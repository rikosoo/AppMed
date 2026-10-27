import {parseMoney} from './money';
export type TaxRegime = 'PF' | 'PJ';
export const taxPercent = (regime: TaxRegime) => regime === 'PF' ? 27 : 15;
export function afterTax(grossCents: number, regime: TaxRegime) {
  const taxCents = Math.floor((grossCents * taxPercent(regime) + 50) / 100);
  return { tax_cents: taxCents, net_cents: grossCents - taxCents };
}
export function paymentFields(data: FormData, legacyAllowed = false): { gross_cents?: number; tax_regime?: TaxRegime; net_cents: number } {
  const amount = parseMoney(String(data.get('value'))) ?? NaN;
  const regime = data.get('tax_regime');
  if (!Number.isSafeInteger(amount) || amount < 1) throw Error('Informe um valor válido.');
  if (regime === 'PF' || regime === 'PJ') return { gross_cents: amount, tax_regime: regime, net_cents: afterTax(amount, regime).net_cents };
  if (regime === 'legacy' && legacyAllowed) return { net_cents: amount };
  throw Error('Selecione Pessoa Física ou Pessoa Jurídica.');
}
