"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.SystemParser = void 0;
var SystemParser = /** @class */ (function () {
  function SystemParser() {}
  SystemParser.unparsePasswords = function (pass2, pass3, pass4) {
    return [
      { tipo: 2, password: pass2 },
      { tipo: 3, password: pass3 },
      { tipo: 4, password: pass4 },
    ];
  };

  const delimiterDefault = String.fromCharCode(45) + String.fromCharCode(45);
  let delimiter = delimiterDefault;
  /**
   * Unparse para envio do local de instalação para a string formatada com delimitador.
   * @param {string} linha1
   * @param {string} linha2
   * @returns {string}
   */
  SystemParser.unparseLocalInstalation = (linha1, linha2) => {
    linha1 = linha1.padEnd(14).slice(0, 14) + delimiter;
    linha2 = linha2.padEnd(14).slice(0, 14) + delimiter;

    return linha1.concat(linha2);
  };

  /**
   * Parseia a string de local de instalação para dividir em duas linhas e remove o delimitador.
   * @param {string} localInstalation
   * @returns {{linha1: string; linha2: string}}
   */
  SystemParser.parseLocalInstalation = (localInstalation) => {
    const localInstalationDelimiter = localInstalation.slice(-2);

    if (localInstalationDelimiter) {
      delimiter = localInstalationDelimiter;
    }

    const linha1 = localInstalation.slice(0, 14);
    const linha2 = localInstalation.slice(16, -2);

    return { linha1, linha2 };
  };

  return SystemParser;
})();
exports.SystemParser = SystemParser;
