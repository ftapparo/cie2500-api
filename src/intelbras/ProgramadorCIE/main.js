/**
 * Criado por Livecom on 3/19/2016.
 * Contato: contato@livecom.io
 * Site: http://livecom.io
 */

try {
  const pathNode = require("path");
  const config = require("./routes/config")();
  const commandTimeout = config.COMMAND_TIMEOUT;
  var nwPath = process.execPath;
  process.env.NODE_PATH = pathNode.dirname(nwPath) + "\\node_modules\\";
  require("module").Module._initPaths();
  const moment = require("moment-timezone");
  moment.tz.setDefault("America/Sao_Paulo");
  const USB = require("usb");
  const crypto = require("crypto");
  const fs = require("fs");
  const WebSocketServer = require("websocket").server; //modulo para websocket com interface
  var fileManager = require("./routes/fileManager");
  const http = require("http");
  var DEFINES = require("./routes/config")();
  const VERSAO_PROGRAMADOR = require("./package.json").version;
  let firmwareFileData;
  let connection; //conexao com interface via websocket
  const encryptor = require("file-encryptor");
  const AdmZip = require("adm-zip");
  var cie_usb = require("./routes/CIE_USB");
  const cie_handler = require("./routes/CIE_USB");
  const udp = require("./routes/udp")(writeToWebsocket);

  const RemoteOpperation = require("./routes/remoteOpperation")(udp);
  const RemoteConnection = require("./routes/remoteConnection")(udp);
  const sslUtils = require("./routes/sslUtils");
  const firmwareUtils = require("./routes/firmwareUtils");

  const communicationServiceModule1060 = require("./routes/tcp/central/communication/cie1060/comunication.service");
  const communicationService1060 =
    new communicationServiceModule1060.CommunicationService();

  const communicationServiceModuleDefault = require("./routes/tcp/central/communication/cieDefault/comunication.service");
  const socketServiceDefaultClass = require("./routes/tcp/central/socket/cieDefault/socket.service");
  const socketServiceDefault = new socketServiceDefaultClass.SocketService();
  const communicationServiceDefault =
    new communicationServiceModuleDefault.CommunicationService(
      socketServiceDefault
    );

  const ConnectionController = require("./routes/connectionController")(
    cie_usb,
    udp,
    writeToWebsocket,
    {
      1060: communicationService1060,
      default: communicationServiceDefault,
    }
  );
  const SystemParser =
    require("./routes/tcp/central/parser/system.parser").SystemParser;
  const LoopParser =
    require("./routes/tcp/central/parser/loop.parser").LoopParser;
  const LogParser = require("./routes/tcp/central/parser/log.parser").LogParser;
  const InconsistencyType =
    require("./routes/tcp/central/config/inconsistecy.type").InconsistencyType;

  const {
    authenticateGateway,
  } = require("./modules/gateway/controllers/gateway-controller");

  console.log("PROGRAMADOR INICIADO", VERSAO_PROGRAMADOR);
  console.log("Diretorio = " + pathNode.dirname(nwPath));

  cie_usb.setIsConfigurationUpdatingExternalFunction = (value) => {
    udp.setIsConfigurationUpdating(value);
  };

  //////////////////////////
  //////// WEBSOCKET ///////
  //////////////////////////
  var server = http.createServer(function (request, response) {
    console.log(new Date() + " Received request for " + request.url);
    response.writeHead(404);
    response.end();
  });
  server.listen(12348, "127.0.0.1", function () {
    console.log(new Date() + " Server is listening on port 12348");
  });
  const wsServer = new WebSocketServer({
    httpServer: server,
    maxReceivedFrameSize: 5 * 1048576, // 5 MB
    maxReceivedMessageSize: 5 * 1048576,
    autoAcceptConnections: false,
  });
  function originIsAllowed(origin) {
    return true;
  }
  wsServer.on("request", function (request) {
    if (!originIsAllowed(request.origin)) {
      request.reject();
      console.log(
        new Date() + " Connection from origin " + request.origin + " rejected."
      );
      return;
    }
    connection = request.accept();
    console.log(new Date() + " Connection accepted.");

    writeToWebsocket({
      event: "version",
      data: { version: VERSAO_PROGRAMADOR },
    });
    cie_usb.callbackWriteWebsoket = writeToWebsocket;

    connection.on("message", async function (message) {
      try {
        //console.log(
        //"+-+- " + new Date() + " RECEIVED MESSAGE FROM INTERFACE: ",
        //message.utf8Data
        //);
        var interface_message = JSON.parse(message.utf8Data);
        switch (interface_message.event) {
          case "change_connection_mode":
            ConnectionController.changeConnectionMode(
              interface_message.data.connectionMode
            );
            break;

          case "stop_wifi_communication":
            writeToWebsocket({ event: "disconnected" });
            break;

          case "udp_assign":
            udp.assign(interface_message.data);
            break;

          case "udp_autenticacao":
            udp.auth(interface_message.data);
            break;

          case "udp_start_communication":
            RemoteOpperation.startCommunication(interface_message.data);
            break;

          case "udp_start_connection":
            RemoteConnection.startConnection(interface_message.data);
            break;

          case "udp_evento":
            RemoteOpperation.getEvent(interface_message.data);
            break;

          case "udp_data_hora":
            RemoteOpperation.getDateTime(interface_message.data);
            break;

          case "udp_enviar_comando":
            RemoteOpperation.sendButtonCommand(interface_message.data);
            break;

          case "udp_force_stop_communication":
            RemoteOpperation.forceStopCommunication();
            break;

          case "udp_bloqueios_contadores":
            RemoteOpperation.getBlocksCounters(interface_message.data);
            break;

          case "udp_saidas_contadores":
            RemoteOpperation.getOutputsCounters(interface_message.data);
            break;

          case "udp_laco":
            RemoteOpperation.getLoops(interface_message.data);
            break;

          case "udp_log":
            RemoteOpperation.getLog(interface_message.data);
            break;

          case "udp_status":
            RemoteOpperation.getStatus(interface_message.data);
            break;

          case "udp_info":
            RemoteOpperation.getInfo(interface_message.data);
            break;

          case "udp_nome_e_modelo":
            RemoteOpperation.getNameModel(interface_message.data);
            break;

          case "udp_mac":
            RemoteOpperation.getMac(interface_message.data);
            break;

          case "udp_regra":
            RemoteOpperation.getRule(interface_message.data);
            break;

          case "udp_zona":
            RemoteOpperation.getZone(interface_message.data);
            break;

          case "udp_zona_todos":
            RemoteOpperation.getZoneAll(interface_message.data);
            break;

          case "udp_dispositivo":
            RemoteOpperation.getDevice(interface_message.data);
            break;

          case "udp_dispositivo_todos":
            RemoteOpperation.getDeviceAll(interface_message.data);
            break;

          case "udp_bloquear":
            RemoteOpperation.changeBlockDevice(interface_message.data);
            break;

          case "udp_ativar_saida":
            RemoteOpperation.changeOutputDevice(interface_message.data);
            break;

          case "udp_regra_todos":
            RemoteOpperation.getRuleAll(interface_message.data);
            break;

          case "udp_crc_regras_temporizando":
            RemoteOpperation.getCRCTimingRule(interface_message.data);
            break;

          case "udp_stop_communication":
            udp.stopCommunication();
            break;

          case "send_configuration":
            var config = interface_message.data.config;
            var testNetworkBoard = interface_message.data.testNetworkBoard;

            if (
              interface_message.data.connectionMode &&
              interface_message.data.connectionMode === "wifi"
            ) {
              await wifiCieDefaultHandler(
                "send_configuration",
                cie_handler.checkNetworkBoard,
                (resNetworkBoard) => {
                  if (
                    resNetworkBoard ||
                    !testNetworkBoard ||
                    (!resNetworkBoard &&
                      parseInt(config.sistema.endereco) === 0)
                  ) {
                    cie_usb.checkInconsistency(config, async function (res) {
                      if (res.inconcistency) {
                        writeToWebsocket(res);
                      } else {
                        writeToWebsocket({
                          event: "no_inconsistency",
                        });
                        await wifiCieDefaultHandler(
                          "send_configuration",
                          cie_handler.sendConfigAndSave,
                          config
                        ).then(
                          (r) => {
                            writeToWebsocket(res);
                          },
                          (e) => {
                            writeToWebsocket({
                              event: "send_configuration",
                              data: {
                                success: false,
                              },
                            });
                          }
                        );
                      }
                    });
                  } else {
                    writeToWebsocket({
                      event: "no_network_board",
                    });
                  }
                }
              ).then(
                (resNetworkBoard) => {},
                (e) => {
                  writeToWebsocket({
                    event: "no_inconsistency",
                    data: { success: false },
                  });
                }
              );
            } else {
              //verifica se a central conectada tem placa ethernet
              cie_usb.checkNetworkBoard(function (resNetworkBoard) {
                if (
                  resNetworkBoard ||
                  !testNetworkBoard ||
                  (!resNetworkBoard && parseInt(config.sistema.endereco) === 0)
                ) {
                  cie_usb.checkInconsistency(config, function (res) {
                    if (res.inconcistency) {
                      writeToWebsocket(res);
                    } else {
                      writeToWebsocket({
                        event: "no_inconsistency",
                      });
                      cie_usb.sendConfigAndSave(config, function (res) {
                        writeToWebsocket(res);
                      });
                    }
                  });
                } else {
                  writeToWebsocket({
                    event: "no_network_board",
                  });
                }
              });
            }

            break;

          case "send_configuration_repeater":
            cie_usb.sendCREConfig(
              interface_message.data.config,
              function (res) {
                writeToWebsocket(res);
              }
            );

            break;

          case "send_configuration_gateway":
            cie_usb.sendGatewayConfig(
              interface_message.data.config,
              function (res) {
                writeToWebsocket(res);
              }
            );

            break;

          case "open_file":
            var path = interface_message.data.path;

            if (
              pathNode.extname(path).toLowerCase() === ".cie" ||
              pathNode.extname(path).toLowerCase() === ".cieproj"
            ) {
              fileManager.openFile(path, "config", function (data) {
                data.data.path = path;
                writeToWebsocket(data);
              });
            } else {
              writeToWebsocket({
                event: "open_file",
                data: { type: "ext_err" },
              });
            }
            break;

          case "generate_private_key":
            try {
              const randomString = crypto.randomBytes(64).toString("hex");
              const base64 = Buffer.from(randomString, "hex").toString(
                "base64"
              );
              writeToWebsocket({
                event: "generate_private_key",
                data: { success: true, config: base64 },
              });
            } catch (e) {
              writeToWebsocket({
                event: "generate_private_key",
                data: { success: false },
              });
            }
            break;

          case "save_programador_cert":
            try {
              sslUtils.saveProgramadorCertificate(
                interface_message.data.path,
                function (err) {
                  if (!err) {
                    writeToWebsocket({
                      event: "save_programador_cert",
                      data: { success: true },
                    });
                  } else {
                    writeToWebsocket({
                      event: "save_programador_cert",
                      data: { success: false },
                    });
                  }
                }
              );
            } catch (e) {
              writeToWebsocket({
                event: "save_programador_cert",
                data: { success: false },
              });
            }
            break;

          case "generate_client_ca":
            try {
              sslUtils.generateCertificate(
                interface_message.data.values,
                async function (generatedFiles) {
                  const parsedCertificates = {};
                  for (const type in generatedFiles) {
                    parseFileCertificate(
                      type,
                      generatedFiles[type],
                      function (parsed) {
                        parsedCertificates[type] = parsed;
                        if (
                          Object.keys(parsedCertificates).length ===
                          Object.keys(generatedFiles).length
                        ) {
                          writeToWebsocket({
                            event: "generate_client_ca",
                            data: {
                              success: true,
                              parsed: parsedCertificates,
                            },
                          });
                          sslUtils.removeCSR(
                            interface_message.data.values.pathGateway
                          );
                        }
                      }
                    );
                  }
                }
              );
            } catch (e) {
              writeToWebsocket({
                event: "generate_client_ca",
                data: { success: false },
              });
            }
            break;

          case "read_certificate_file":
            try {
              parseFileCertificate(
                interface_message.data.type,
                interface_message.data.path,
                function (parsed) {
                  writeToWebsocket({
                    event: "read_certificate_file",
                    data: {
                      data: parsed,
                      type: interface_message.data.type,
                    },
                  });
                }
              );
            } catch (e) {
              writeToWebsocket({
                event: "read_certificate_file",
              });
            }
            break;

          case "save_file":
            var replace_file;
            if ("replace" in interface_message.data) {
              replace_file = true;
            } else {
              replace_file = false;
            }

            var config = {};
            config = interface_message.data.config;
            var path = interface_message.data.path;
            config.versao = VERSAO_PROGRAMADOR;
            fileManager.saveFile(
              path,
              replace_file,
              "config",
              config,
              function (callback) {
                writeToWebsocket(callback);
              }
            );
            break;

          case "open_loop_calculator_file":
            try {
              var path = interface_message.data.path;
              if (pathNode.extname(path).toLowerCase() === ".ciecalc") {
                fs.readFile(path, "utf8", function (err, data) {
                  if (err) {
                    writeToWebsocket({
                      event: "open_loop_calculator_file",
                      data: { error: "file" },
                    });
                  } else {
                    writeToWebsocket({
                      event: "open_loop_calculator_file",
                      data: {
                        success: true,
                        config: JSON.parse(data),
                      },
                    });
                  }
                });
              } else {
                writeToWebsocket({
                  event: "open_loop_calculator_file",
                  data: { error: "ext" },
                });
              }
            } catch (e) {
              writeToWebsocket({
                event: "open_loop_calculator_file",
                data: { error: "catch" },
              });
            }
            break;

          case "save_loop_calculator_file":
            try {
              fs.writeFile(
                interface_message.data.path,
                JSON.stringify(interface_message.data.config),
                function (err) {
                  if (err) {
                    writeToWebsocket({
                      event: "save_loop_calculator_file",
                      data: { error: "file" },
                    });
                  } else {
                    writeToWebsocket({
                      event: "save_loop_calculator_file",
                      data: { success: true },
                    });
                  }
                }
              );
            } catch (e) {
              writeToWebsocket({
                event: "open_loop_calculator_file",
                data: { error: "catch" },
              });
            }
            break;

          case "gateway_save_logs_to_file":
            try {
              var filename =
                "\\LogGW521_" + new Date().toLocaleString() + ".txt";
              filename = filename
                .replace(/:/g, "")
                .replace(/\//g, "")
                .replace(/-/g, "")
                .replace(/ /g, "_");
              filename = interface_message.data.path + filename;
              fs.writeFile(
                filename,
                interface_message.data.content,
                function (err) {
                  if (err) {
                    writeToWebsocket({
                      event: "gateway_save_logs_to_file",
                      data: { error: "file" },
                    });
                  } else {
                    writeToWebsocket({
                      event: "gateway_save_logs_to_file",
                      data: { success: true },
                    });
                  }
                }
              );
            } catch (e) {
              writeToWebsocket({
                event: "gateway_save_logs_to_file",
                data: { error: "catch" },
              });
            }
            break;

          case "get_configuration":
            cie_usb.getCIEconfig(function (res) {
              writeToWebsocket(res);
            });
            break;

          case "send_configuration_tcp":
            const inconcistencyType = {
              0: "tipo",
              1: "novo",
              2: "removido",
            };

            var fileData = interface_message.data.config;

            try {
              const devices = await communicationService1060.getDevices(
                fileData
              );
              const inconsistencies = LoopParser.analyzeInconsistency(
                fileData,
                devices
              );
              if (
                inconsistencies[InconsistencyType.TYPE].length > 0 ||
                inconsistencies[InconsistencyType.HAS_ONLY_CENTRAL].length >
                  0 ||
                inconsistencies[InconsistencyType.HAS_ONLY_DATA].length > 0
              ) {
                const inconcistenciesParsed = [];
                for (const inconsistencyType in inconsistencies) {
                  for (const inconsistency of inconsistencies[
                    inconsistencyType
                  ]) {
                    inconcistenciesParsed.push({
                      inconsistency: inconcistencyType[inconsistencyType],
                      endereco:
                        inconsistency.addressCentral ||
                        inconsistency.addressData,
                      tipo: inconsistency.typeData,
                      novoTipo: inconsistency.typeCentral,
                    });
                  }
                }
                writeToWebsocket({
                  event: "send_configuration",
                  data: {
                    success: true,
                    inconsistency: true,
                    config: inconcistenciesParsed,
                  },
                });
              } else {
                writeToWebsocket({ event: "no_inconsistency" });

                await communicationService1060.refreshControls();

                const parsedDevices = LoopParser.unparseDevices(fileData);
                await communicationService1060.sendDevices(parsedDevices);

                const parsedPasswords = SystemParser.unparsePasswords(
                  fileData.sistema.senha_2 || "",
                  fileData.sistema.senha_3 || "",
                  fileData.sistema.senha_4 || ""
                );
                await communicationService1060.sendPasswords(parsedPasswords);

                const localInstalation = SystemParser.unparseLocalInstalation(
                  fileData.sistema.local_instalacao_linha1 || "",
                  fileData.sistema.local_instalacao_linha2 || ""
                );
                await communicationService1060.sendLocalInstalation(
                  localInstalation
                );

                await communicationService1060.sendMaxDelayTime(
                  fileData.sistema.retardo || ""
                );

                await communicationService1060.sendDefaultRule({
                  delayTime: fileData.regras["1"].temporizacao,
                  responderBotaoAlarmeGeral: fileData.regras["1"].alarme,
                  entradaUnicaOuDupla: fileData.regras["1"].condicao_entrada,
                  ativacaoDeSaidaImediataTemporizada:
                    fileData.regras["1"].ativacao_saida,
                  novaEntradaCancelaTemporizacao:
                    fileData.regras["1"].cancelavel,
                  ativada: fileData.regras["1"].habilitado,
                });

                await communicationService1060.sendClass(
                  fileData.sistema.operacao || "A"
                );

                await communicationService1060.sendBlockDevices({
                  laco: fileData.bloqueios_locais.laco || false,
                  regraPadrao: fileData.bloqueios_locais.regraPadrao || false,
                  releDeAlarme: fileData.bloqueios_locais.releDeAlarme || false,
                  releDeFalha: fileData.bloqueios_locais.releDeFalha || false,
                  sireneConvencional:
                    fileData.bloqueios_locais.sireneConvencional || false,
                });

                await communicationService1060.centralDisconnect();

                writeToWebsocket({
                  event: "restarting_central",
                });
              }
            } catch (e) {
              writeToWebsocket({
                event: "send_configuration",
                data: { success: false },
              });
            }
            break;

          case "get_configuration_tcp":
            if (interface_message.data.model === "CIE1060") {
              var fileData = interface_message.data.emptyConfig;

              try {
                await communicationService1060.refreshControls();

                const loops = await communicationService1060.getDevices();

                const parsedDevicesLoop1 = LoopParser.parseDevices(loops);

                fileData.lacos[1].dispositivos = parsedDevicesLoop1;

                const passwords = await communicationService1060.getPasswords();

                if (fileData && fileData.sistema) {
                  fileData.sistema.senha_2 = passwords[0];
                  fileData.sistema.senha_3 = passwords[1];
                  fileData.sistema.senha_4 = passwords[2];
                  fileData.sistema.operacao =
                    await communicationService1060.getClass();
                  const localInstalationParsed =
                    await communicationService1060.getLocalInstalation();
                  const localInstalation = SystemParser.parseLocalInstalation(
                    localInstalationParsed
                  );
                  fileData.sistema.local_instalacao_linha1 =
                    localInstalation.linha1;
                  fileData.sistema.local_instalacao_linha2 =
                    localInstalation.linha2;
                  fileData.sistema.retardo =
                    await communicationService1060.getMaxDelayTime();
                }

                const defaultRule =
                  await communicationService1060.getDefaultRule();
                fileData.regras["1"].habilitado = defaultRule.ativada;
                fileData.regras["1"].temporizacao = defaultRule.delayTime;
                fileData.regras["1"].brigada = false;
                fileData.regras["1"].alarme =
                  defaultRule.responderBotaoAlarmeGeral;
                fileData.regras["1"].condicao_entrada =
                  defaultRule.entradaUnicaOuDupla;
                fileData.regras["1"].ativacao_saida =
                  defaultRule.ativacaoDeSaidaImediataTemporizada;
                fileData.regras["1"].cancelavel =
                  defaultRule.novaEntradaCancelaTemporizacao;

                const deviceBlocks =
                  await communicationService1060.getBlockDevices();
                fileData.regras["1"].habilitado = !deviceBlocks.regraPadrao;
                fileData.lacos["1"].habilitado = !deviceBlocks.laco;
                fileData.bloqueios_locais = deviceBlocks;

                writeToWebsocket({
                  event: "get_configuration",
                  data: { success: true, config: fileData },
                });
              } catch (e) {
                writeToWebsocket({
                  event: "get_configuration",
                  data: { success: false },
                });
              }
            } else {
              await wifiCieDefaultHandler(
                "get_configuration",
                cie_handler.getCIEconfig,
                (resp) => {}
              ).then(
                (resp) => {
                  writeToWebsocket(resp);
                },
                (e) => {
                  console.log("get configuration error", e);
                  writeToWebsocket({
                    event: "get_configuration",
                    data: { success: false },
                  });
                }
              );
            }

            break;

          case "get_configuration_repeater":
            cie_usb.getCREconfig(function (res) {
              writeToWebsocket(res);
            });
            break;

          case "get_configuration_gateway":
            cie_usb.getGatewayConfig(function (res) {
              writeToWebsocket(res);
            });
            break;

          case "set_gateway_auth_eth":
            authenticateGateway(interface_message.data, (res) =>
              writeToWebsocket({
                event: "set_gateway_auth_eth",
                data: res,
              })
            );
            break;

          case "get_desktop_date":
            var date = new moment();
            writeToWebsocket({
              event: "get_desktop_date",
              data: {
                hour: date.hours(),
                min: date.minutes(),
                sec: date.second(),
              },
            });
            break;

          case "verify_usb_1060_connection":
            if (
              interface_message.data.connectionMode &&
              interface_message.data.connectionMode === "wifi" &&
              ConnectionController.hasConnection()
            ) {
              const usbConnection =
                await communicationService1060.isUSBConnected();
              writeToWebsocket({
                event: "verify_usb_1060_connection",
                data: {
                  success: true,
                  usbConnection: usbConnection,
                },
              });
            }
            break;

          case "verify_usb_1060_connection_boot_mode":
            const devices = USB.getDeviceList();
            const cie1060Connected = devices.find(
              (d) =>
                d.deviceDescriptor &&
                d.deviceDescriptor.idVendor === 1155 &&
                d.deviceDescriptor.idProduct === 57105
            );
            if (cie1060Connected) {
              writeToWebsocket({
                event: "verify_usb_1060_connection",
                data: { success: true, usbConnection: "boot" },
              });
            } else {
              writeToWebsocket({
                event: "verify_usb_1060_connection",
                data: { success: false, usbConnection: "boot" },
              });
            }
            break;

          case "get_logs":
            if (
              interface_message.data.connectionMode &&
              interface_message.data.connectionMode === "wifi"
            ) {
              console.log("Dentro do if - wifi");

              if (
                interface_message.data.model &&
                interface_message.data.model === "CIE1060"
              ) {
                console.log("DENTRO DO CIE 1060");
                const json_logs = {
                  alarme: [],
                  falha: [],
                  supervisao: [],
                  operacao: [],
                };

                const logsAlarme = await communicationService1060.getLogs(
                  "alarme",
                  processEventLog
                );
                const logsFalha = await communicationService1060.getLogs(
                  "falha",
                  processEventLog
                );
                const logsOperacao = await communicationService1060.getLogs(
                  "operacao",
                  processEventLog
                );

                json_logs.alarme = LogParser.unparseLogs(logsAlarme, "alarme");
                json_logs.falha = LogParser.unparseLogs(logsFalha, "falha");
                json_logs.operacao = LogParser.unparseLogs(
                  logsOperacao,
                  "operacao"
                );
                writeToWebsocket({
                  event: "get_logs",
                  data: { success: true, logs: json_logs },
                });
              } else {
                console.log("HANDLER GERAL");
                await wifiCieDefaultHandler(
                  "get_logs",
                  cie_handler.getCIELogs
                ).then(
                  (resp) => {
                    writeToWebsocket(resp);
                  },
                  (e) => {
                    writeToWebsocket({
                      event: "get_logs",
                      data: { success: false },
                    });
                  }
                );
              }
            } else {
              console.log("DENTRO DO ULTIMO ELSE");
              writeToWebsocket({
                event: "get_logs",
                data: { success: false },
              });
              cie_usb.getCIELogs(function (res) {
                writeToWebsocket(res);
              });
            }
            break;
          case "save_logs":
            if (interface_message.data.csv) {
              var path = interface_message.data.path;
              fileManager.saveCSV(
                path,
                interface_message.data.logs,
                function (callback) {
                  writeToWebsocket(callback);
                }
              );
            } else {
              var logs_json = {};
              logs_json.logs = interface_message.data.logs;
              logs_json.endereco = interface_message.data.endereco;
              logs_json.modelo = interface_message.data.modelo;
              var path = interface_message.data.path;
              fileManager.saveFile(
                path,
                true,
                "cielog",
                logs_json,
                function (callback) {
                  writeToWebsocket(callback);
                }
              );
            }
            break;

          case "open_logs":
            var path = interface_message.data.path;

            if (pathNode.extname(path).toLowerCase() != ".cielog") {
              writeToWebsocket({
                event: "open_logs",
                data: { type: "ext_err" },
              });
            } else {
              fileManager.openFile(path, "cielog", function (data) {
                writeToWebsocket(data);
              });
            }
            break;

          case "reset_config":
            cie_usb.resetConfig(function (res) {
              writeToWebsocket(res);
            });
            break;

          case "reset_logs":
            cie_usb.resetLogs(function (res) {
              writeToWebsocket(res);
            });
            break;

          case "get_date":
            if (
              interface_message.data.connectionMode &&
              interface_message.data.connectionMode === "wifi"
            ) {
              if (interface_message.data.model === "CIE1060") {
                const dateTime = await communicationService1060.getDateTime();
                writeToWebsocket({
                  event: "get_date",
                  data: {
                    success: true,
                    dateFormat: dateTime,
                  },
                });
              } else {
                await wifiCieDefaultHandler(
                  "get_date",
                  cie_handler.getDate
                ).then(
                  (resp) => {
                    writeToWebsocket(resp);
                  },
                  (e) => {
                    writeToWebsocket({
                      event: "get_date",
                      data: { success: false },
                    });
                  }
                );
              }
            } else {
              cie_usb.getDate(function (res) {
                writeToWebsocket(res);
              });
            }
            break;

          case "set_date":
            if (
              interface_message.data.connectionMode &&
              interface_message.data.connectionMode === "wifi"
            ) {
              if (interface_message.data.model === "CIE1060") {
                await communicationService1060.sendDateTime(
                  new Date(interface_message.data.dateFormat)
                );
                writeToWebsocket({
                  event: "set_date",
                  data: { success: true },
                });
              } else {
                await wifiCieDefaultHandler(
                  "set_date",
                  cie_handler.setDate,
                  interface_message.data
                ).then(
                  (resp) => {
                    writeToWebsocket(resp);
                  },
                  (e) => {
                    writeToWebsocket({
                      event: "set_date",
                      data: { success: false },
                    });
                  }
                );
              }
            } else {
              cie_usb.setDate(interface_message.data, function (res) {
                writeToWebsocket(res);
              });
            }
            break;

          case "get_info":
            if (
              interface_message.data.connectionMode &&
              interface_message.data.connectionMode === "wifi"
            ) {
              if (interface_message.data.model === "CIE1060") {
                const centralInfo =
                  await communicationService1060.getFirmwareVersion();
                writeToWebsocket({
                  event: "get_info",
                  data: {
                    success: true,
                    firmware: centralInfo.version,
                    centralModel: "CIE1060",
                  },
                });
              } else {
                await wifiCieDefaultHandler(
                  "get_info",
                  cie_handler.getInfo
                ).then(
                  (resp) => {
                    writeToWebsocket(resp);
                  },
                  (e) => {
                    writeToWebsocket({
                      event: "get_info",
                      data: { success: false },
                    });
                  }
                );
              }
            } else {
              cie_usb.getInfo(function (res) {
                writeToWebsocket(res);
              });
            }
            break;

          case "get_info_gateway":
            cie_usb.getInfoGateway(function (res) {
              writeToWebsocket(res);
            });
            break;

          case "gateway_change_mac":
            cie_usb.gatewayChangeMac(
              interface_message.data.mac,
              function (res) {
                writeToWebsocket(res);
              }
            );
            break;

          case "gateway_clear_registers":
            cie_usb.gatewayClearRegister(function (res) {
              writeToWebsocket(res);
            });
            break;

          case "gateway_factory_reset":
            cie_usb.gatewayFactoryReset(function (res) {
              writeToWebsocket(res);
            });
            break;

          case "gateway_restart":
            cie_usb.gatewayRestart(function (res) {
              writeToWebsocket(res);
            });
            break;

          case "get_gateway_errors":
            cie_usb.getInfoGatewayErrors(function (res) {
              writeToWebsocket(res);
            });
            break;

          case "block":
            if (
              interface_message.data.connectionMode &&
              interface_message.data.connectionMode === "wifi"
            ) {
              if (interface_message.data.model === "CIE1060") {
                await communicationService1060.centralDisconnect();
                writeToWebsocket({
                  event: "central_restart",
                  data: { success: true },
                });
              } else {
                await wifiCieDefaultHandler("block", cie_handler.block).then(
                  (res) => {
                    writeToWebsocket({
                      event: "central_restart",
                      data: { success: true },
                    });
                  },
                  (e) => {
                    writeToWebsocket({
                      event: "central_restart",
                      data: { success: false },
                    });
                  }
                );
              }
            } else {
              cie_usb.block(function (res) {
                writeToWebsocket(res);
              });
            }
            break;

          case "call_loop_scan":
            cie_usb.callLoopScan(interface_message.data.loop, function (res) {
              writeToWebsocket(res);
            });
            break;

          case "check_firmware_file":
            var firmwarecietemp = "firmwarecietemp" + new Date().getTime();
            var key =
              "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855";
            var cryptkey = crypto.createHash("sha256");
            var response = {
              event: "check_firmware_file",
              data: {},
            };
            var comparator = 0;
            var path = interface_message.data.path;
            var centralVersion = interface_message.data.centralVersion;
            var isGateway = interface_message.data.isGateway;
            var sha256 = "";
            var fileSize = fileManager.checkSizeFile(path);
            var extension = pathNode.extname(path).toLowerCase();
            var isFirmwareDevVersion =
              path.search(DEFINES.firmwareDevVersion) !== -1;

            if (
              (!isGateway &&
                ((interface_message.data.is1060 && extension !== ".cie1060f") ||
                  (!interface_message.data.is1060 && extension !== ".cief"))) ||
              (isGateway && extension !== ".gwf")
            ) {
              response.data.error = "ext_err";
              writeToWebsocket(response);
            } else if (fileSize > 10 * 1024 * 1024 || fileSize == 0) {
              response.data.error = "size_err";
              writeToWebsocket(response);
            } else {
              try {
                encryptor.decryptFile(
                  path,
                  firmwarecietemp,
                  key,
                  function (err) {
                    if (err) {
                      response.data.error = "file_error";
                      writeToWebsocket(response);
                    } else {
                      var zip = new AdmZip(firmwarecietemp);
                      var zipEntries = zip.getEntries();
                      zipEntries.forEach(function (zipEntry) {
                        if (zipEntry.entryName == "versao") {
                          response.data.fileVersion = zipEntry
                            .getData()
                            .toString("utf8");
                        } else if (zipEntry.entryName == "sha256") {
                          sha256 = zipEntry.getData().toString();
                        } else {
                          firmwareFileData = zipEntry.getData();
                          if (interface_message.data.is1060) {
                            fs.writeFileSync(
                              __dirname + "/" + firmwarecietemp + ".bin",
                              firmwareFileData
                            );
                            response.data.path = firmwarecietemp + ".bin";
                          }
                        }
                      });

                      cryptkey.update(firmwareFileData);
                      var shaBin = cryptkey.digest("hex");
                      comparator = versionComparator(
                        response.data.fileVersion,
                        centralVersion
                      );
                      response.data.centralVersion =
                        interface_message.data.centralVersion;

                      if (interface_message.data.is1060) {
                        comparator = 1;
                      }

                      if (shaBin != sha256) {
                        response.data.error = "corrupt_err";
                        writeToWebsocket(response);
                      } else if (comparator == 1) {
                        response.data.success = true;
                        writeToWebsocket(response);
                      } else if (comparator == 0) {
                        if (isFirmwareDevVersion) {
                          response.data.success = true;
                          writeToWebsocket(response);
                        } else {
                          response.data.error = "minor_version";
                          writeToWebsocket(response);
                        }
                      } else {
                        response.data.error = "minor_version";
                        writeToWebsocket(response);
                      }
                    }
                  }
                );
              } catch (e) {
                response.data.error = "error";
                writeToWebsocket(response);
              }
            }

            break;

          case "firmware":
            var progress = 20;
            var response = { event: "firmware", data: {} };
            var progressInterval;

            if (interface_message.data.is1060) {
              const usbConnection =
                await communicationService1060.isUSBConnected();
              if (usbConnection) {
                writeToWebsocket({
                  event: "firmware",
                  data: { progress },
                });
                const enjoyBootloader =
                  await communicationService1060.startBootloaerMode();
                if (enjoyBootloader) {
                  progress += 30;
                  writeToWebsocket({
                    event: "firmware",
                    data: { progress },
                  });
                  setTimeout(() => {
                    firmwareUtils.update(
                      interface_message.data.path,
                      function (resp) {
                        clearInterval(progressInterval);
                        response.data.success = resp.success;
                        response.data.error = resp.error;
                        writeToWebsocket(response);
                      }
                    );
                  }, 10000);
                  progressInterval = setInterval(() => {
                    if (progress < 100) {
                      progress += 1;
                      writeToWebsocket({
                        event: "firmware",
                        data: { progress },
                      });
                    }
                  }, 500);
                }
              } else {
                clearInterval(progressInterval);
                response.data.error = "usb_disconnected";
                writeToWebsocket(response);
              }
              return;
            } else if (interface_message.data.bootMode) {
              progress += 30;
              writeToWebsocket({
                event: "firmware",
                data: { progress },
              });
              firmwareUtils.update(
                interface_message.data.path,
                function (resp) {
                  clearInterval(progressInterval);
                  response.data.success = resp.success;
                  response.data.error = resp.error;
                  writeToWebsocket(response);
                }
              );
              progressInterval = setInterval(() => {
                if (progress < 100) {
                  progress += 1;
                  writeToWebsocket({
                    event: "firmware",
                    data: { progress },
                  });
                }
              }, 500);
              return;
            }

            if (!firmwareFileData) {
              response.data.error = "disconnected";
              writeToWebsocket(response);
            } else {
              if (
                interface_message.data.connectionMode &&
                interface_message.data.connectionMode === "wifi"
              ) {
                await wifiCieDefaultHandler(
                  "firmware",
                  cie_handler.sendFirmware,
                  firmwareFileData,
                  (res) => {
                    writeToWebsocket(res);
                  }
                ).then(
                  (res) => {
                    writeToWebsocket(res);
                  },
                  (e) => {
                    writeToWebsocket({
                      event: "firmware",
                      data: { success: false },
                    });
                  }
                );
              } else {
                cie_usb.sendFirmware(firmwareFileData, function (res) {
                  if (res.error) {
                    response.data.error = "disconnected";
                    writeToWebsocket(response);
                    firmwareFileData = undefined;
                  }
                });
              }
            }

            break;

          case "get_flash_dump":
            cie_usb.getFlashDump(interface_message.data.path, function (res) {
              writeToWebsocket(res);
            });
            break;

          case "gateway_save_dump":
            cie_usb.getGatewayFlashDump(
              interface_message.data.path,
              function (res) {
                writeToWebsocket(res);
              }
            );
            break;

          case "get_gateway_logs":
            cie_usb.authGatewayAdvancedCommands(function (res) {
              writeToWebsocket(res);
            });
            break;

          case "auth_gateway_advanced_commands":
            cie_usb.authGatewayAdvancedCommands(
              interface_message.data,
              function (res) {
                writeToWebsocket(res);
              }
            );
            break;

          case "gateway_get_log":
            cie_usb.gatewayGetLog(function (res) {
              writeToWebsocket(res);
            });
            break;

          case "print":
            if (interface_message.data.pathPdf === "") return;

            var puppeteer = require("puppeteer");

            puppeteer.launch().then(function (browser) {
              browser.newPage().then(function (page) {
                page
                  .goto("file://" + interface_message.data.pathHtml, {
                    waitUntil: "networkidle2",
                  })
                  .then(function () {
                    page
                      .pdf({
                        path: interface_message.data.pathPdf,
                        margin: {
                          top: "40px",
                          right: "35px",
                          bottom: "40px",
                          left: "35px",
                        },
                      })
                      .then(function () {
                        setTimeout(function () {
                          writeToWebsocket({
                            event: "print",
                            data: {
                              success: true,
                              path: interface_message.data.pathPdf,
                            },
                          });
                        }, 3000);
                        browser.close();
                        fs.unlink(interface_message.data.pathHtml);
                      }, errorPdf);
                  }, errorPdf);
              }, errorPdf);
            }, errorPdf);

            function errorPdf(e) {
              writeToWebsocket({
                event: "print",
                error: e,
                data: {
                  success: false,
                  path: interface_message.data.pathPdf,
                },
              });
            }

            break;
        }
      } catch (e) {
        if (
          interface_message.data.connectionMode &&
          interface_message.data.connectionMode === "wifi"
        ) {
          writeToWebsocket({ event: "tcp_fail", data: { error: e } });
        }
      }
    });

    connection.on("close", function (reasonCode, description) {
      console.log(
        new Date() + " Peer " + connection.remoteAddress + " disconnected."
      );
      //udp.stopCommunication();
    });
  });

  function writeToWebsocket(command) {
    connection.sendUTF(JSON.stringify(command));
    //console.log(
    //"-*-*" + new Date() + " MESSAGE SENT TO INTERFACE: ",
    //JSON.stringify(command)
    //);
  }

  function processEventLog(frame) {
    let { progress, event_type, is1060 } = frame;
    const event_name = config.log.events[event_type].label;
    let logSteps = ["alarme", "falha", "supervisao", "operacao"];

    if (is1060) {
      logSteps = ["alarme", "falha", "operacao"];
    }
    if (isNaN(progress)) {
      progress = "0.00";
    }
    writeToWebsocket({
      event: "get_logs",
      data: {
        success: true,
        currentFrameProgress: progress,
        overallProgress: progress,
        currentLogType: event_name,
        logSteps,
      },
    });
  }
  async function wifiCieDefaultHandler(
    event,
    functionHandler,
    dataToSend,
    callback
  ) {
    return new Promise((acc, rej) => {
      try {
        cie_handler.setSendFunction(async (data) => {
          console.log(data);
          const buffer = Buffer.from(data);
          const response = await communicationServiceDefault.sendBuffer(buffer);

          if (response) {
            console.log("wifi response", response.response);
            cie_handler.CommunicationHandler(
              response.frame.payload,
              config.connectionsMode.WIFI,
              null,
              processEventLog
            );

            if (response.response === "TIMEOUT") {
              console.log("timeout wifi");
              cie_handler.CommunicationHandler([
                commandTimeout,
                response.frame,
              ]);
            }
          } else {
            cie_handler.CommunicationHandler(response);
          }
        });

        setTimeout(() => {
          functionHandler(dataToSend, callback);
        }, 100);

        cie_handler.setCallbackFunction((data) => {
          if (data.event && data.event !== "disconnected") {
            if (callback) {
              callback(data);
            } else {
              acc(data);
            }
          }
        });
      } catch (e) {
        rej(e);
      }
    });
  }
} catch (e) {
  console.log(e);
  if (typeof alert !== "undefined") {
    alert(e);
  }
}

function versionComparator(version, otherVersion) {
  var v1 = version.split(".");
  var v2 = otherVersion.split(".");
  for (var i = 0; i < 3; i++) {
    var n1 = parseInt(v1[i]);
    var n2 = parseInt(v2[i]);
    if (n1 == n2) {
      continue;
    } else if (n1 < n2) {
      return -1;
    } else if (n1 > n2) {
      return 1;
    } /*
		 if(n1 < n2) {
            return -1;
        } else if(n1 >= n2) {
            return 1;
        }*/
  }
  return 0;
}

function parseFileCertificate(type, path, callback) {
  var command;
  var needContains;
  switch (type) {
    case "root_ca_file":
      command = DEFINES.CIE_commands.SET_SSLTLS_ROOT_CA;
      needContains = "CERTIFICATE";
      break;
    case "self_ca_file":
      command = DEFINES.CIE_commands.SET_SSLTLS_SELF_CERT;
      needContains = "CERTIFICATE";
      break;
    case "self_ca_pk_file":
      command = DEFINES.CIE_commands.SET_SSLTLS_SELF_CERT_PK;
      needContains = "PRIVATE KEY";
      break;
  }
  fileManager.openCertFile(path, function (data) {
    const dataFormatted = Buffer.from(data).toString();

    if (!dataFormatted) {
      console.log("INVALID CERTIFICATE");
      callback({ error: true });
      return;
    }

    if (!dataFormatted.includes(needContains)) {
      console.log("INVALID CERTIFICATE CONTAINS");
      callback({ error: true });
      return;
    }

    cie_usb.parseCertificateFile(data, command, function (parsed) {
      callback(parsed);
    });
  });
}
