import json
import os
import sys
from pathlib import Path

folder = Path(__file__).resolve().parent
sys.path.insert(0, str(folder.parent / 'plot-deps'))
os.environ.setdefault('MPLCONFIGDIR', str(folder / '.matplotlib-cache'))
import matplotlib
matplotlib.use('Agg')
import matplotlib.pyplot as plt
from matplotlib.ticker import FuncFormatter

data = json.loads((folder / 'quotes-four-pools.json').read_text(encoding='utf-8'))
stable = '0x5fc5360d0400a0fd4f2af552add042d716f1d168'
colors = {'CATGPT': '#2563eb', 'ANTHROPIG': '#d97706'}
plt.rcParams.update({'font.family': 'DejaVu Sans', 'font.size': 10, 'axes.titleweight': 'bold'})
fig, axes = plt.subplots(1, 2, figsize=(13.5, 6.8), sharey=True)
fig.set_facecolor('#f8fafc')

for ax, is_stable in zip(axes, [False, True]):
    ax.set_facecolor('#ffffff')
    for pool in data['pools']:
        if (pool['quoteAddress'].lower() == stable) != is_stable:
            continue
        quotes = [q for q in pool['quotes'] if q['side'] == 'sell' and q['notionalQuoteAtSpot'] >= 100]
        x = [q['notionalQuoteAtSpot'] for q in quotes]
        y = [q['shortfallVsSpotPct'] for q in quotes]
        ax.plot(x, y, marker='o', markersize=6, linewidth=2.3, color=colors[pool['name']], label=pool['name'])
        for q in quotes:
            if q['notionalQuoteAtSpot'] in (10000, 25000):
                ax.annotate(f"{q['shortfallVsSpotPct']:.1f}%", (q['notionalQuoteAtSpot'], q['shortfallVsSpotPct']),
                            xytext=(0, 9), textcoords='offset points', ha='center', color=colors[pool['name']],
                            fontsize=10, fontweight='bold')
    baseline = 5.095 if is_stable else 1.5972
    ax.axhline(baseline, color='#64748b', linestyle='--', linewidth=1)
    ax.text(105, baseline + 1, f'Fees mínimas ≈ {baseline:.3f}%', fontsize=9, color='#64748b')
    ax.set_xscale('log')
    ax.set_xlim(80, 36000)
    ax.set_ylim(0, 61)
    ax.set_xticks([100, 1000, 5000, 10000, 25000], ['100', '1.000', '5.000', '10.000', '25.000'])
    ax.yaxis.set_major_formatter(FuncFormatter(lambda v, _: f'{v:.0f}%'))
    ax.grid(axis='y', color='#e2e8f0', linewidth=0.8)
    ax.spines[['top', 'right']].set_visible(False)
    ax.spines[['left', 'bottom']].set_color('#cbd5e1')
    ax.tick_params(axis='both', length=0, pad=8, colors='#334155')
    ax.set_title('Salida al wrapper LongX' if not is_stable else 'Salida directa a USDG', loc='left', pad=18)
    ax.set_xlabel('Nominal en unidades del wrapper (escala log)' if not is_stable else 'Nominal en USDG (escala log)', labelpad=15)
    ax.legend(frameon=False, loc='upper left')

axes[0].set_ylabel('Menor salida respecto al precio previo del pool', labelpad=13)
fig.suptitle('La profundidad cambia mucho según el tamaño y el pool', fontsize=19, fontweight='bold', x=.075, ha='left', y=.975)
fig.text(.075, .915, 'Venta simulada • fees + impacto del tamaño • mismo bloque para los cuatro pools', color='#475569', fontsize=11)
fig.text(.075, .10, '12 sep 2026 · 06:05:54 UTC · bloque 60.879.734 · Quoter oficial Uniswap v4 / Robinhood Chain', color='#475569', fontsize=9)
fig.text(.075, .062, 'Cada nominal se calcula con el spot de su propio pool. Una unidad de wrapper no equivale necesariamente a un USDG.', color='#475569', fontsize=9)
fig.text(.075, .029, 'Puntos: simulaciones observadas; líneas: guía visual. Gas y ruta posterior no incluidos. No se ejecutaron operaciones.', color='#475569', fontsize=9)
fig.subplots_adjust(left=.075, right=.97, bottom=.23, top=.83, wspace=.17)
fig.savefig(folder / 'depth-comparison.png', dpi=170, facecolor=fig.get_facecolor())
fig.savefig(folder / 'depth-comparison.svg', facecolor=fig.get_facecolor())
plt.close(fig)
print(folder / 'depth-comparison.png')
