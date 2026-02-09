const config = require("./config")();
const CIE_commands = config.CIE_commands;
const gateway_commands = require("./../modules/gateway/services/gateway-service-commands");

const commandHandler = {
  [CIE_commands.SET_GATEWAY_FLASH_DUMP]: gateway_commands.setGatewayFlashDump,
  [CIE_commands.SET_GATEWAY_INFO]: gateway_commands.setGatewayInfo,
  [CIE_commands.GET_GATEWAY_INFO]: gateway_commands.getGatewayInfo,
  [CIE_commands.SET_GATEWAY_MAC]: gateway_commands.setGatewayMac,
  [CIE_commands.SET_GATEWAY_ERASE_EVENTS]:
    gateway_commands.setGatewayEraseEvents,
  [CIE_commands.SET_GATEWAY_RESET_FABRICA]:
    gateway_commands.setGatewayResetFabrica,
  [CIE_commands.SET_GATEWAY_RESET]: gateway_commands.setGatewayReset,
  [CIE_commands.GET_GATEWAY_ERRORS]: gateway_commands.getGatewayErrors,
  [CIE_commands.SET_GATEWAY_ADVANCED_CMDS]:
    gateway_commands.setGatewayAdvancedCmds,
  [CIE_commands.GET_GATEWAY_LOG]: gateway_commands.getGatewayLog,
};

function executeCommand(commandKey, data, ...args) {
  if (commandHandler[commandKey]) {
    try {
      const result = commandHandler[commandKey](data, ...args);
      console.log(`Comando ${commandKey} executado com sucesso:`, result);
      return result;
    } catch (error) {
      console.error(`Erro ao executar o comando ${commandKey}:`, error);
      return { error: `Erro ao executar o comando ${commandKey}` };
    }
  } else {
    console.warn(`Comando ${commandKey} não encontrado.`);
    return { error: `Comando ${commandKey} não encontrado.` };
  }
}

module.exports = {
  executeCommand,
  commandHandler,
};
