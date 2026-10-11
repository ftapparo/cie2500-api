import installation from '../data/cie-installation.json';
import { describeDevice, parsePlace } from './cie-event-catalog';
import type { CiePlace } from '../../types/logs';

// Cadastro da central (zonas, regras, dispositivos) gerado do .cie exportado
// pelo ProgramadorCIE — ver scripts/import-cie-config.js. Completa o que o
// evento UDP não traz ou traz truncado: o subtipo chega com 3 bits (a sirene
// S2 é subtipo 7 no cadastro), operações trazem só o número da regra.

type InstallationDevice = (typeof installation.devices)[number];
type InstallationRule = (typeof installation.rules)[number];

const deviceByKey = new Map<string, InstallationDevice>(
  installation.devices.map((d) => [`${d.loop}:${d.address}`, d]),
);
const zoneById = new Map<number, string | null>(installation.zones.map((z) => [z.id, z.name]));
const ruleById = new Map<number, InstallationRule>(installation.rules.map((r) => [r.id, r]));

export function findDevice(loop: number | null, address: number | null): InstallationDevice | null {
  if (loop === null || address === null) return null;
  return deviceByKey.get(`${loop}:${address}`) ?? null;
}

export function zoneName(id: number | null): string | null {
  if (id === null || id <= 0) return null;
  return zoneById.get(id) ?? null;
}

export function ruleName(id: number | null): string | null {
  if (id === null || id <= 0) return null;
  return ruleById.get(id)?.name ?? null;
}

const LOCAL_AREA = 'Central de incêndio';

/** Local do dispositivo: nome cadastrado, ou zona, ou a própria central (laço 0). */
export function placeOf(
  loop: number | null,
  name: string | null,
  zone: number | null,
  zoneLabel: string | null,
  localOutput?: string | null,
): CiePlace | null {
  // Laço 0 são as saídas/entradas da própria central (S1, S2, S3, fonte).
  if (loop === 0) {
    const detail = localOutput ? `Saída ${localOutput}` : (name || null);
    return {
      tower: null, towerLabel: null, floor: null, floorLabel: null,
      position: null, positionLabel: null, area: LOCAL_AREA, areaDetail: detail,
    };
  }

  const fromName = parsePlace(name);
  const fromZone = parsePlace(zoneLabel ?? zoneName(zone));
  if (!fromName) return fromZone;
  // Nome sem torre (ex.: "ELEVADOR 1") herda a torre da zona, se a zona tiver.
  if (!fromName.tower && fromZone?.tower) {
    return { ...fromName, tower: fromZone.tower, towerLabel: fromZone.towerLabel };
  }
  return fromName;
}

export function getInstallation() {
  return {
    model: installation.model,
    firmware: installation.firmware,
    installation: installation.installation,
    zones: installation.zones.map((z) => ({ ...z, place: parsePlace(z.name) })),
    rules: installation.rules.map((r) => ({ id: r.id, name: r.name, enabled: r.enabled, inputs: r.inputs, outputs: r.outputs })),
    devices: installation.devices.map((d) => {
      const device = describeDevice(d.type, d.subtype, d.name, true);
      return {
        loop: d.loop,
        address: d.address,
        name: d.name,
        device: device?.resolvedLabel ?? null,
        type: d.type,
        subtype: d.subtype,
        zone: d.zone,
        zoneName: zoneName(d.zone),
        enabled: d.enabled,
        localOutput: d.localOutput,
        place: placeOf(d.loop, d.name, d.zone, null, d.localOutput),
      };
    }),
  };
}
