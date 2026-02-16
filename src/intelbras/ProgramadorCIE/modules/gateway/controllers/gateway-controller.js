const config = require("../../../routes/config")();
const gatewayService = require("../services/gateway-service");

/**
 * @typedef {Object} AuthData
 * @property {string} ip - O endereço IP do gateway.
 * @property {string} password - A senha para autenticação.
 * @property {number} [port] - A porta TCP, valor padrão se não fornecido.
 */

/**
 * Autentica o gateway usando os dados fornecidos.
 * @param {AuthData} data - ip, password, port.
 * @param {Function} callback
 * @returns {Promise<void>}
 */
async function authenticateGateway(data, callback) {
  const { ip, password, port } = data;
  const tcpPort = port || config.DEFAULT_TCP_PORT;

  await gatewayService.authenticateGateway(ip, tcpPort, password, callback);
}

/**
 * Envia dados para o gateway após autenticação.
 * @param {Buffer|string} data - Dados para enviar ao gateway.
 * @returns {Promise<void>}
 */
async function sendData(data) {
  await gatewayService.sendData(data);
}

module.exports = {
  authenticateGateway,
  sendData,
};
