import type { CieClient } from '../core/cie-client';

export type CommandAction =
  | 'silence'
  | 'release'
  | 'release-bip'
  | 'release-siren'
  | 'restart'
  | 'brigade-siren'
  | 'alarm-general'
  | 'delay-siren'
  | 'silence-bip'
  | 'silence-siren';

type BlockCommandPayload = {
  tipoBloqueio: number;
  laco: number;
  numero: number;
  bloquear: number;
};

type OutputCommandPayload = {
  laco: number;
  numero: number;
  ativo: number;
};

type CommandMapping = {
  button: number;
  parameter: number;
};

type MappingConfig = Record<CommandAction, CommandMapping | null>;

export class CieCommandService {
  private identifier = 0;
  private readonly client: CieClient;
  private readonly mapping: MappingConfig;

  constructor(client: CieClient) {
    this.client = client;
    const silenceDefault = this.readMapping('CIE_CMD_SILENCE_BUTTON', 'CIE_CMD_SILENCE_PARAM');
    const releaseDefault = this.readMapping('CIE_CMD_RELEASE_BUTTON', 'CIE_CMD_RELEASE_PARAM');
    const restartDefault = this.readMapping('CIE_CMD_RESTART_BUTTON', 'CIE_CMD_RESTART_PARAM');
    this.mapping = {
      silence: silenceDefault,
      release: releaseDefault,
      'release-bip': this.readMapping('CIE_CMD_RELEASE_BIP_BUTTON', 'CIE_CMD_RELEASE_BIP_PARAM') ?? releaseDefault,
      'release-siren': this.readMapping('CIE_CMD_RELEASE_SIREN_BUTTON', 'CIE_CMD_RELEASE_SIREN_PARAM') ?? releaseDefault,
      restart: restartDefault,
      'brigade-siren': this.readMapping('CIE_CMD_BRIGADE_SIREN_BUTTON', 'CIE_CMD_BRIGADE_SIREN_PARAM'),
      'alarm-general': this.readMapping('CIE_CMD_ALARM_GENERAL_BUTTON', 'CIE_CMD_ALARM_GENERAL_PARAM'),
      'delay-siren': this.readMapping('CIE_CMD_DELAY_SIREN_BUTTON', 'CIE_CMD_DELAY_SIREN_PARAM'),
      'silence-bip': this.readMapping('CIE_CMD_SILENCE_BIP_BUTTON', 'CIE_CMD_SILENCE_BIP_PARAM') ?? silenceDefault,
      'silence-siren': this.readMapping('CIE_CMD_SILENCE_SIREN_BUTTON', 'CIE_CMD_SILENCE_SIREN_PARAM') ?? silenceDefault,
    };
  }

  private readMapping(buttonEnv: string, parameterEnv: string): CommandMapping | null {
    const button = Number(process.env[buttonEnv]);
    const parameter = Number(process.env[parameterEnv] ?? 0);
    if (!Number.isFinite(button)) return null;
    if (!Number.isFinite(parameter)) return null;
    return { button, parameter };
  }

  private nextIdentifier() {
    this.identifier += 1;
    if (this.identifier > 255) this.identifier = 1;
    return this.identifier;
  }

  private isNotConfiguredResponse(response: any): boolean {
    return String(response?.resposta || '') === 'StatusBotaoNaoConfigurado';
  }

  private async executeCustomMapping(mapping: CommandMapping): Promise<any> {
    const identifier = this.nextIdentifier();
    return this.client.sendButtonCommand(mapping.button, mapping.parameter, identifier);
  }

  private executeMapped(action: CommandAction) {
    const mapping = this.mapping[action];
    if (!mapping) {
      const err = new Error(`Comando '${action}' nao mapeado por variavel de ambiente.`);
      (err as any).status = 409;
      throw err;
    }

    const identifier = this.nextIdentifier();
    return this.client.sendButtonCommand(mapping.button, mapping.parameter, identifier);
  }

  async execute(action: CommandAction) {
    const primary = await this.executeMapped(action);

    // Algumas centrais nao possuem comando dedicado de release para bip/sirene.
    // Fallback para comportamento do software original:
    // mesmo botao com parametro invertido (toggle), depois demais alternativas.
    if (action === 'release-bip' && this.isNotConfiguredResponse(primary)) {
      const silenceBip = this.mapping['silence-bip'];
      if (silenceBip) {
        try {
          const inverseToggle = await this.executeCustomMapping({
            button: silenceBip.button,
            parameter: silenceBip.parameter === 0 ? 1 : 0,
          });
          if (!this.isNotConfiguredResponse(inverseToggle)) return inverseToggle;
        } catch {
          // tenta proximo fallback
        }
      }

      try {
        const release = await this.executeMapped('release');
        if (!this.isNotConfiguredResponse(release)) return release;
      } catch {
        // tenta proximo fallback
      }

      try {
        const toggle = await this.executeMapped('silence-bip');
        if (!this.isNotConfiguredResponse(toggle)) return toggle;
      } catch {
        // mantem resposta primaria
      }
    }

    if (action === 'release-siren' && this.isNotConfiguredResponse(primary)) {
      const silenceSiren = this.mapping['silence-siren'];
      if (silenceSiren) {
        try {
          const inverseToggle = await this.executeCustomMapping({
            button: silenceSiren.button,
            parameter: silenceSiren.parameter === 0 ? 1 : 0,
          });
          if (!this.isNotConfiguredResponse(inverseToggle)) return inverseToggle;
        } catch {
          // tenta proximo fallback
        }
      }

      try {
        const release = await this.executeMapped('release');
        if (!this.isNotConfiguredResponse(release)) return release;
      } catch {
        // tenta proximo fallback
      }

      try {
        const toggle = await this.executeMapped('silence-siren');
        if (!this.isNotConfiguredResponse(toggle)) return toggle;
      } catch {
        // mantem resposta primaria
      }
    }

    return primary;
  }

  executeBlockCommand(payload: BlockCommandPayload) {
    const identifier = this.nextIdentifier();
    return this.client.changeBlockDevice(
      payload.tipoBloqueio,
      payload.laco,
      payload.numero,
      payload.bloquear,
      identifier
    );
  }

  executeOutputCommand(payload: OutputCommandPayload) {
    const identifier = this.nextIdentifier();
    return this.client.changeOutputDevice(payload.laco, payload.numero, payload.ativo, identifier);
  }

  getBlockCounters() {
    return this.client.getBlocksCounters();
  }

  getOutputCounters() {
    return this.client.getOutputsCounters();
  }
}
