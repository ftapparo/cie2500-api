import type { CieClient } from '../core/cie-client';

export type CommandAction = 'silence' | 'release' | 'restart';

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
    this.mapping = {
      silence: this.readMapping('CIE_CMD_SILENCE_BUTTON', 'CIE_CMD_SILENCE_PARAM'),
      release: this.readMapping('CIE_CMD_RELEASE_BUTTON', 'CIE_CMD_RELEASE_PARAM'),
      restart: this.readMapping('CIE_CMD_RESTART_BUTTON', 'CIE_CMD_RESTART_PARAM'),
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

  execute(action: CommandAction) {
    const mapping = this.mapping[action];
    if (!mapping) {
      const err = new Error(`Comando '${action}' não mapeado por variável de ambiente.`);
      (err as any).status = 409;
      throw err;
    }

    const identifier = this.nextIdentifier();
    return this.client.sendButtonCommand(mapping.button, mapping.parameter, identifier);
  }
}

