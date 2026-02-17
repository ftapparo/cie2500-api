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

const OFFICIAL_BUTTONS = {
  BRIGADE_SIREN: 0,
  ALARM_GENERAL: 1,
  DELAY_RULE: 2,
  RESTART_CENTRAL: 3,
  SILENCE_SIREN: 4,
  SILENCE_CENTRAL_BIP: 5,
} as const;

export class CieCommandService {
  private identifier = 0;
  private readonly client: CieClient;
  private readonly mapping: MappingConfig;

  constructor(client: CieClient) {
    this.client = client;
    const silenceDefault = this.readMapping(
      'CIE_CMD_SILENCE_BUTTON',
      'CIE_CMD_SILENCE_PARAM',
      { button: OFFICIAL_BUTTONS.SILENCE_CENTRAL_BIP, parameter: 0 }
    );
    const releaseDefault = this.readMapping(
      'CIE_CMD_RELEASE_BUTTON',
      'CIE_CMD_RELEASE_PARAM',
      // No software oficial, liberação de bip também usa o mesmo botão (toggle).
      { button: OFFICIAL_BUTTONS.SILENCE_CENTRAL_BIP, parameter: 0 }
    );
    const restartDefault = this.readMapping(
      'CIE_CMD_RESTART_BUTTON',
      'CIE_CMD_RESTART_PARAM',
      { button: OFFICIAL_BUTTONS.RESTART_CENTRAL, parameter: 0 }
    );
    this.mapping = {
      silence: silenceDefault,
      release: releaseDefault,
      'release-bip': this.readMapping(
        'CIE_CMD_RELEASE_BIP_BUTTON',
        'CIE_CMD_RELEASE_BIP_PARAM',
        { button: OFFICIAL_BUTTONS.SILENCE_CENTRAL_BIP, parameter: 0 }
      ),
      'release-siren': this.readMapping(
        'CIE_CMD_RELEASE_SIREN_BUTTON',
        'CIE_CMD_RELEASE_SIREN_PARAM',
        { button: OFFICIAL_BUTTONS.SILENCE_SIREN, parameter: 0 }
      ),
      restart: restartDefault,
      'brigade-siren': this.readMapping(
        'CIE_CMD_BRIGADE_SIREN_BUTTON',
        'CIE_CMD_BRIGADE_SIREN_PARAM',
        { button: OFFICIAL_BUTTONS.BRIGADE_SIREN, parameter: 0 }
      ),
      'alarm-general': this.readMapping(
        'CIE_CMD_ALARM_GENERAL_BUTTON',
        'CIE_CMD_ALARM_GENERAL_PARAM',
        { button: OFFICIAL_BUTTONS.ALARM_GENERAL, parameter: 0 }
      ),
      'delay-siren': this.readMapping(
        'CIE_CMD_DELAY_SIREN_BUTTON',
        'CIE_CMD_DELAY_SIREN_PARAM',
        { button: OFFICIAL_BUTTONS.DELAY_RULE, parameter: 250 }
      ),
      'silence-bip': this.readMapping(
        'CIE_CMD_SILENCE_BIP_BUTTON',
        'CIE_CMD_SILENCE_BIP_PARAM',
        { button: OFFICIAL_BUTTONS.SILENCE_CENTRAL_BIP, parameter: 0 }
      ),
      'silence-siren': this.readMapping(
        'CIE_CMD_SILENCE_SIREN_BUTTON',
        'CIE_CMD_SILENCE_SIREN_PARAM',
        { button: OFFICIAL_BUTTONS.SILENCE_SIREN, parameter: 0 }
      ),
    };
  }

  private readMapping(
    buttonEnv: string,
    parameterEnv: string,
    fallback: CommandMapping
  ): CommandMapping {
    const rawButton = process.env[buttonEnv];
    const rawParameter = process.env[parameterEnv];
    const button = Number(rawButton);
    const parameter = Number(rawParameter ?? fallback.parameter);
    if (!Number.isFinite(button) || !Number.isFinite(parameter)) return fallback;

    // Compatibilidade com .env legado (todos comandos em 0).
    // Se o fallback oficial nao eh 0, considera 0 como placeholder e usa fallback.
    if (rawButton === '0' && fallback.button !== 0) {
      return fallback;
    }

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

  private sameMapping(a: CommandMapping | null, b: CommandMapping | null): boolean {
    if (!a || !b) return false;
    return a.button === b.button && a.parameter === b.parameter;
  }

  private async executeCustomMapping(mapping: CommandMapping): Promise<any> {
    const identifier = this.nextIdentifier();
    return this.client.sendButtonCommand(mapping.button, mapping.parameter, identifier);
  }

  private invertParameter(mapping: CommandMapping): CommandMapping {
    return {
      button: mapping.button,
      parameter: mapping.parameter === 0 ? 1 : 0,
    };
  }

  private pushUniqueMapping(list: CommandMapping[], mapping: CommandMapping | null) {
    if (!mapping) return;
    if (list.some((item) => item.button === mapping.button && item.parameter === mapping.parameter)) return;
    list.push(mapping);
  }

  private async readLedState(
    ledKey: 'centralSilenciada' | 'sireneSilenciada'
  ): Promise<boolean | null> {
    try {
      const status = await this.client.status();
      const ledValue = (status as any)?.leds?.[ledKey];
      return typeof ledValue === 'boolean' ? ledValue : null;
    } catch {
      return null;
    }
  }

  private async waitForLedTarget(
    ledKey: 'centralSilenciada' | 'sireneSilenciada',
    targetValue: boolean,
    attempts = 8,
    delayMs = 300
  ): Promise<{ matched: boolean; lastState: boolean | null; deterministic: boolean }> {
    let lastState: boolean | null = null;
    let deterministic = false;

    for (let i = 0; i < attempts; i += 1) {
      const state = await this.readLedState(ledKey);
      lastState = state;
      if (state !== null) deterministic = true;
      if (state === targetValue) {
        return { matched: true, lastState: state, deterministic };
      }
      if (i < attempts - 1) {
        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }
    }

    return { matched: false, lastState, deterministic };
  }

  private async executeUntilLedTarget(
    ledKey: 'centralSilenciada' | 'sireneSilenciada',
    targetValue: boolean,
    candidates: CommandMapping[]
  ) {
    let lastResponse: any = null;
    let lastError: any = null;
    let hadDeterministicLedRead = false;
    let lastLedState: boolean | null = null;

    for (const candidate of candidates) {
      try {
        const response = await this.executeCustomMapping(candidate);
        lastResponse = response;

        if (this.isNotConfiguredResponse(response)) {
          continue;
        }

        // A central pode demorar alguns centenas de ms para refletir o novo estado.
        const settled = await this.waitForLedTarget(ledKey, targetValue);
        lastLedState = settled.lastState;
        if (settled.deterministic) hadDeterministicLedRead = true;
        if (settled.matched) {
          return response;
        }
      } catch (error) {
        lastError = error;
      }
    }

    if (hadDeterministicLedRead && lastLedState !== targetValue) {
      const err = new Error('Comando enviado, mas a central manteve o estado anterior.');
      (err as any).status = 409;
      throw err;
    }

    if (lastResponse) return lastResponse;
    if (lastError) throw lastError;

    const err = new Error('Nao foi possivel confirmar execucao do comando na central.');
    (err as any).status = 409;
    throw err;
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
    // Comportamento observado no software oficial:
    // o comando de "silenciar bip" e unidirecional na operacao remota.
    // A reativacao ocorre apenas localmente na central (ou via reinicio).
    if (action === 'release-bip') {
      const err = new Error('Reativar bip nao e suportado por comando remoto nesta central.');
      (err as any).status = 409;
      throw err;
    }

    // Release de bip/sirene: algumas centrais variam no parametro (toggle 0/1).
    // Tentamos combinacoes e validamos pelo LED correspondente.
    if (action === 'release-siren') {
      const releaseSiren = this.mapping['release-siren'];
      const silenceSiren = this.mapping['silence-siren'];
      const release = this.mapping['release'];
      const candidates: CommandMapping[] = [];

      this.pushUniqueMapping(candidates, releaseSiren);
      if (releaseSiren) this.pushUniqueMapping(candidates, this.invertParameter(releaseSiren));
      this.pushUniqueMapping(candidates, release);
      if (release) this.pushUniqueMapping(candidates, this.invertParameter(release));
      this.pushUniqueMapping(candidates, silenceSiren);
      if (silenceSiren) this.pushUniqueMapping(candidates, this.invertParameter(silenceSiren));

      if (this.sameMapping(releaseSiren, silenceSiren) && silenceSiren) {
        candidates.unshift(this.invertParameter(silenceSiren));
      }

      return this.executeUntilLedTarget('sireneSilenciada', false, candidates);
    }

    const primary = await this.executeMapped(action);

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
