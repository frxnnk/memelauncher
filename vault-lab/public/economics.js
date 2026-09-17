import { projectEconomy } from './economics-model.js';
const $ = selector => document.querySelector(selector);
const form = $('#economics-inputs');
const count = number => number.toLocaleString('en-US', { maximumFractionDigits: 2 });
const usd = number => number.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 4 });
let current;
function render() {
  try {
    const input = Object.fromEntries([...new FormData(form)].map(([key, value]) => [key, value === '' ? NaN : Number(value)]));
    const result = projectEconomy(input); current = { input, result };
    $('#input-error').hidden = true; $('#projection').hidden = false;
    const labels = [['prize', 'Prize'], ['operations', 'Operations'], ['next', 'Next round']];
    $('#split-labels').replaceChildren();
    for (const [key, label] of labels) {
      $(`#split-${key}`).style.width = `${result.perAttempt[key] / input.attemptTokens * 100}%`;
      const text = document.createElement('span'); text.textContent = `${label} ${count(result.perAttempt[key])}`; $('#split-labels').append(text);
    }
    $('#split-bar').setAttribute('aria-label', labels.map(([key,label]) => `${label}: ${result.perAttempt[key]} tokens`).join(', '));
    $('#prize-result').textContent = count(result.prizeTokens); $('#next-result').textContent = count(result.nextRoundTokens);
    $('#operations-result').textContent = usd(result.operatingResultUsd); $('#operations-result').dataset.negative = String(result.operatingResultUsd < 0);
    $('#coverage-result').textContent = result.externalOperatingSupportUsd > 0 ? `${usd(result.externalOperatingSupportUsd)} external operating support needed.` : 'Costs covered under these assumptions only.';
    const rows = [ ['Expected API calls, including errors', count(result.expectedApiCalls)], ['Expected refunded error calls', count(result.expectedErrorCalls)],
      ['Assumed API cost', usd(result.apiCostsUsd)], ['Other operating costs', usd(input.fixedUsd)], ['Operating tokens after conversion · USD', usd(result.netOperationsUsd)],
      ['Break-even token value · USD', result.breakEvenTokenUsd === null ? 'No realizable operating allocation' : usd(result.breakEvenTokenUsd)],
      ['Next seed coverage', result.nextRoundSeedCoverage === null ? 'No seed target' : `${count(result.nextRoundSeedCoverage * 100)}% of initial seed`] ];
    $('#cost-breakdown').replaceChildren(...rows.map(([label,value]) => { const row = document.createElement('div'), dt = document.createElement('dt'), dd = document.createElement('dd'); dt.textContent = label; dd.textContent = value; row.append(dt,dd); return row; }));
  } catch (error) { current = null; $('#projection').hidden = true; $('#input-error').hidden = false; $('#input-error').textContent = error.message; }
}
form.addEventListener('submit', event => event.preventDefault()); form.addEventListener('input', render);
$('#export-economics').addEventListener('click', () => {
  if (!current) return;
  const blob = new Blob([JSON.stringify({ version:'vault-economic-projection-v1', createdAt:new Date().toISOString(), ...current },null,2)],{type:'application/json'});
  const url = URL.createObjectURL(blob), link = document.createElement('a'); link.href = url; link.download = 'vault-economic-scenario.json'; document.body.append(link); link.click(); link.remove(); setTimeout(() => URL.revokeObjectURL(url),1000);
});
render();
