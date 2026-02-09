const { exec } = require("child_process");
const { copyFile, unlinkSync } = require("fs");
const pathNode = require("path");
const nwPath = process.execPath;

const rootCertsLocation = __dirname + "/rootCerts/";
const location = pathNode.dirname(nwPath) + "\\openssl\\";
// const location = 'C:/Users/Pablo/Desktop/workspace/programador-cie/openssl/';
const openSslLocation = `"${location}openssl"`;
const rootCaFilename = `${rootCertsLocation}rootCA.crt`;
const rootCaKey = `${rootCertsLocation}rootCA.key`;
const keyFileName = "{PATH}/gw521.key";
const csrFileName = "{PATH}/gw521.csr";
const crtFileName = "{PATH}/gw521.crt";

const privateKeyCommand = `${openSslLocation} genrsa -out "${keyFileName}" 1024`;
const requestCommand = `${openSslLocation} req -config "${location}openssl.cnf" -new -sha256 -key "${keyFileName}" -subj "/C={PAIS}/ST={ESTADO}/L={CIDADE}/O={ORGANIZACAO}/CN={UNIDADE}" -out "${csrFileName}"`;
const assignCommand = `${openSslLocation} x509 -req -in "${csrFileName}" -CA "${rootCaFilename}" -CAkey "${rootCaKey}" -CAcreateserial -out "${crtFileName}" -days 3650 -sha256`;

const SslUtils = {
  generateCertificate: function (values, callback) {
    try {
      const parsedCertificates = {};
      generatePrivateKey(values.pathGateway, function (pathPrivateKey) {
        parsedCertificates.self_ca_pk_file = pathPrivateKey;
        generateCSR(values, function () {
          generateCRT(values.pathGateway, function (selfCaPath) {
            parsedCertificates.self_ca_file = selfCaPath;
            callback(parsedCertificates);
          });
        });
      });
    } catch (e) {
      throw e;
    }
  },
  saveProgramadorCertificate: function (path, callback) {
    copyFile(rootCaFilename, path + "/CertRootCA_ProgramadorCIE.crt", callback);
  },
  removeCSR: function (path) {
    try {
      unlinkSync(csrFileName.replace(/{PATH}/g, path));
    } catch (e) {}
  },
};

function run(command, callback) {
  exec(command, (err, stdout, stderr) => {
    if (!err) {
      callback();
    } else {
      alert(JSON.stringify(err));
      alert(JSON.stringify(stderr));
      alert(JSON.stringify(stdout));
      throw err;
    }
  });
}

function generatePrivateKey(pathGateway, callback) {
  run(privateKeyCommand.replace(/{PATH}/g, pathGateway), function () {
    callback(keyFileName.replace(/{PATH}/g, pathGateway));
  });
}

function generateCSR(
  { pathGateway, pais, estado, cidade, organizacao, unidade },
  callback
) {
  const command = requestCommand
    .replace(/{PATH}/g, pathGateway)
    .replace("{PAIS}", pais)
    .replace("{ESTADO}", estado)
    .replace("{CIDADE}", cidade)
    .replace("{ORGANIZACAO}", organizacao)
    .replace("{UNIDADE}", unidade);
  run(command, callback);
}

function generateCRT(pathGateway, callback) {
  const command = assignCommand.replace(/{PATH}/g, pathGateway);
  run(command, function () {
    callback(crtFileName.replace(/{PATH}/g, pathGateway));
  });
}

module.exports = SslUtils;
