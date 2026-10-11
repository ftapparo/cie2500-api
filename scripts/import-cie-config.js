#!/usr/bin/env node
/**
 * Gera src/core/data/cie-installation.json a partir do arquivo .cie exportado
 * pelo ProgramadorCIE (configuração da central).
 *
 * O .cie tem as senhas de nível 2/3/4 da central e a configuração de rede:
 * por isso ele NÃO é versionado (*.cie no .gitignore) e só zonas, regras e
 * dispositivos vão para o JSON.
 *
 * Uso: node scripts/import-cie-config.js CIE25000.cie
 * Rodar de novo sempre que a configuração da central mudar.
 */
const fs = require('fs');
const path = require('path');

const input = process.argv[2];
if (!input) {
  console.error('Uso: node scripts/import-cie-config.js <arquivo.cie>');
  process.exit(1);
}

const cfg = JSON.parse(fs.readFileSync(input, 'utf8'));
const clean = (s) => (typeof s === 'string' ? s.replace(/\s+/g, ' ').trim() : null);

const zones = Object.values(cfg.zonas || {})
  .map((z) => ({ id: z.id, name: clean(z.nome), enabled: !!z.habilitado }))
  .sort((a, b) => a.id - b.id);

const rules = Object.values(cfg.regras || {})
  .map((r) => ({
    id: r.id,
    name: clean(r.nome),
    enabled: !!r.habilitado,
    inputs: (r.itens || []).filter((i) => i.modo === 'entrada')
      .map((i) => (i.tipo === 'zona' ? { zone: i.id } : { loop: i.laco, address: i.endereco })),
    outputs: (r.itens || []).filter((i) => i.modo === 'saida')
      .map((i) => (i.tipo === 'zona' ? { zone: i.id } : { loop: i.laco, address: i.endereco })),
  }))
  .sort((a, b) => a.id - b.id);

const devices = [];
for (const loop of cfg.lacos || []) {
  for (const d of Object.values(loop.dispositivos || {})) {
    devices.push({
      loop: d.laco,
      address: d.endereco,
      type: d.tipo,
      subtype: d.subtipo,
      zone: d.zona || null,
      name: clean(d.nome),
      enabled: !!d.habilitado,
      localOutput: d.saida_local || null,
      defaultOutput: !!d.saida_padrao,
    });
  }
}
devices.sort((a, b) => a.loop - b.loop || a.address - b.address);

const sys = cfg.sistema || {};
const defaultOutputs = {};
for (const kind of ['alarme', 'falha', 'supervisao']) {
  const o = sys[kind];
  if (o && o.habilitada) defaultOutputs[kind] = { loop: o.laco, address: o.endereco };
}

const out = {
  source: path.basename(input),
  model: sys.modelo_central || null,
  firmware: sys.firmware || null,
  installation: clean(sys.local_instalacao),
  defaultOutputs,
  zones,
  rules,
  devices,
};

const target = path.join(__dirname, '..', 'src', 'core', 'data', 'cie-installation.json');
fs.mkdirSync(path.dirname(target), { recursive: true });
fs.writeFileSync(target, JSON.stringify(out, null, 2) + '\n');
console.log(`${target}: ${zones.length} zonas, ${rules.length} regras, ${devices.length} dispositivos`);
