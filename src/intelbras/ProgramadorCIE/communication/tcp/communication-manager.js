const net = require("net");

/**
 * Gerenciador de comunicação TCP.
 */
class TCPCommunicationManager {
  /**
   * @param {string} ip - Endereço IP do dispositivo.
   * @param {number} port - Porta TCP do dispositivo.
   * @param {function} onDataCallback - Função de callback para processar dados recebidos.
   */
  constructor(ip, port, onDataCallback) {
    this.ip = ip;
    this.port = port;
    this.onDataCallback = onDataCallback;
    this.client = null;
    this.isConnected = false;
    this.reconnectAttempts = 0;
    this.maxReconnectAttempts = 5;
  }

  /**
   * Estabelece conexão com o servidor.
   * @returns {Promise<void>}
   */
  async connect() {
    if (this.isConnected) {
      return;
    }

    return new Promise((resolve, reject) => {
      this.client = new net.Socket();
      this.client.connect(this.port, this.ip, () => {
        this.isConnected = true;
        this.reconnectAttempts = 0;
        //console.log(`Conectado ao servidor ${this.ip}:${this.port}`);
        resolve();
      });

      this.client.on("data", (data) => {
        if (this.onDataCallback) {
          this.onDataCallback(data);
        }
      });

      this.client.on("error", (error) => {
        console.error("Erro no socket:", error.message);
        this.isConnected = false;
        reject(error);
      });

      this.client.on("close", () => {
        console.warn("Conexão fechada.");
        this.isConnected = false;
      });
    });
  }

  /**
   * Envia dados para o servidor.
   * @param {Buffer|string} data - Dados a serem enviados.
   * @returns {Promise<void>}
   */
  async send(data) {
    if (!this.isConnected) {
      await this.connect();
    }

    return new Promise((resolve, reject) => {
      this.client.write(data, (error) => {
        if (error) {
          console.error("Erro ao enviar dados:", error.message);
          reject(error);
        }

        resolve();
      });
    });
  }

  /**
   * Fecha a conexão atual.
   */
  async close() {
    if (this.client) {
      this.client.destroy();
      this.isConnected = false;
      //console.log("Conexão encerrada.");
    }
  }

  /**
   * Lida com tentativas de reconexão automáticas.
   * @private
   */
  async _handleReconnect() {
    if (this.reconnectAttempts >= this.maxReconnectAttempts) {
      console.error("Máximo de tentativas de reconexão atingido.");
      return;
    }

    this.reconnectAttempts += 1;

    try {
      await this.connect();
      //console.log("Reconexão bem-sucedida.");
    } catch (error) {
      console.error("Falha na reconexão:", error.message);
      setTimeout(() => this._handleReconnect(), 3000);
    }
  }
}

module.exports = TCPCommunicationManager;
