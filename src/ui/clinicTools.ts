import { Tool } from '../game/types';
import { VitalId } from '../sim/types';

/**
 * Parametri che si prendono sul modello 3D (con il loro strumento). Gli altri (mucose, TRC, stato mentale,
 * pressione) si fanno in una finestra, come nei minigiochi della scheda di PS.
 */
export const VITAL_TOOL: Partial<Record<VitalId, Tool>> = {
  temp: Tool.Thermometer,
  polso: Tool.Pulse,
  resp: Tool.Resp,
};

export function toolForVital(v: VitalId): Tool | undefined {
  return VITAL_TOOL[v];
}
