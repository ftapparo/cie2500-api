/**
 * Criado por Livecom on 12/10/2018.
 * Contato: contato@livecom.io
 * Site: http://livecom.io
 */

var CONFIG = require("./udpConfig");
var parserConfig = require("./parseConfig");
var global_config = require("./config")();
var bitwise = require("bitwise");
var modelos_centrais = Object.keys(global_config.modelos_centrais);

module.exports = {
  /*
        Função para envio ao websocket
     */
  parser: function (data) {
    var POSICAO = CONFIG.POSICAO;
    var TAMANHO = CONFIG.TAMANHO;
    var COMANDO = CONFIG.COMANDO;
    var RESPOSTA = CONFIG.RESPOSTA;

    var command = data[0];
    var obj = {};

    switch (command) {
      case COMANDO.COMANDO_SINCRONIZACAO_COORDENADOR:
        var centrais = {};
        var bitMask = new Array();

        bitMask = bitwise.byte
          .read(
            data[
            POSICAO.POSICAO_MENSAGEM_INTERLIGACAO_SINCRONIZACAO_CENTRAIS_CONECTADAS +
            1
            ]
          )
          .concat(
            bitwise.byte.read(
              data[
              POSICAO
                .POSICAO_MENSAGEM_INTERLIGACAO_SINCRONIZACAO_CENTRAIS_CONECTADAS
              ]
            )
          );

        for (
          var i = CONFIG.NR_CENTRAIS_INTERLIGACAO_CENTRAIS - 1;
          i >= 0;
          i--
        ) {
          if (bitMask[i]) {
            var endereco = CONFIG.NR_CENTRAIS_INTERLIGACAO_CENTRAIS - i;
            centrais[endereco] = {
              endereco: endereco,
              ip: arrayToIp(
                data,
                POSICAO.POSICAO_MENSAGEM_INTERLIGACAO_SINCRONIZACAO_IP_ADRESS_DEVICES +
                4 * (endereco - 1)
              ),
              utc: toDate(data),
              timestamp: new Date().getTime(),
            };
          }
        }

        var counterSend = Buffer.from(
          data.slice(
            POSICAO.POSICAO_MENSAGEM_INTERLIGACAO_SINCRONIZACAO_SEC_COUNTER_SEND,
            POSICAO.POSICAO_MENSAGEM_INTERLIGACAO_SINCRONIZACAO_SEC_COUNTER_RECV
          )
        ).readUInt16LE();
        var counterRecv = Buffer.from(
          data.slice(
            POSICAO.POSICAO_MENSAGEM_INTERLIGACAO_SINCRONIZACAO_SEC_COUNTER_RECV,
            POSICAO.POSICAO_MENSAGEM_INTERLIGACAO_SINCRONIZACAO_SEC_COUNTER_RECV +
            2
          )
        ).readUInt16LE();

        obj = {
          event: "udp_descobrir",
          data: centrais,
          counterSend: counterSend,
          counterRecv: counterRecv,
        };

        break;

      case COMANDO.COMANDO_ENVIA_DATA_HORA_INTERLIGACAO_CENTRAL:
        var utc = new Date(
          data[
          POSICAO.POSICAO_MENSAGEM_INTERLIGACAO_SINCRONIZACAO_DATA_HORA_RTC_ANO
          ],
          data[
          POSICAO
            .POSICAO_MENSAGEM_INTERLIGACAO_SINCRONIZACAO_DATA_HORA_RTC_MES
          ] - 1,
          data[
          POSICAO.POSICAO_MENSAGEM_INTERLIGACAO_SINCRONIZACAO_DATA_HORA_RTC_DIA
          ],
          data[
          POSICAO.POSICAO_MENSAGEM_INTERLIGACAO_SINCRONIZACAO_DATA_HORA_RTC_HORA
          ],
          data[
          POSICAO.POSICAO_MENSAGEM_INTERLIGACAO_SINCRONIZACAO_DATA_HORA_RTC_MINUTO
          ],
          data[
          POSICAO.POSICAO_MENSAGEM_INTERLIGACAO_SINCRONIZACAO_DATA_HORA_RTC_SEGUNDO
          ]
        );

        obj = {
          event: "udp_data_hora",
          data: { utc: utc, timestamp: new Date().getTime() },
        };

        break;

      case COMANDO.COMANDO_NAK_RESPOSTA_CONTADOR_INVALIDO:
        var counterSendNak = Buffer.from(data.slice(1, 3)).readUInt16LE();
        var counterRecvNak = Buffer.from(data.slice(3, 5)).readUInt16LE();

        obj = {
          event: "udp_nak_contador",
          counterSend: counterSendNak,
          counterRecv: counterRecvNak,
        };

        break;

      case COMANDO.COMANDO_ENVIA_MAC_ADDRESS_CENTRAL:
        var mac = "";
        for (
          var i = POSICAO.POSICAO_MENSAGEM_MAC_ADRESS_MAC;
          i < TAMANHO.TAMANHO_MENSAGEM_MAC_ADRESS;
          i++
        ) {
          mac += pad(new Number(data[i]).toString(16)) + ":";
        }

        obj = {
          event: "udp_mac",
          data: {
            mac: mac.substring(0, mac.length - 1).toUpperCase(),
          },
        };

        break;

      case COMANDO.COMANDO_ENVIA_NOME_CENTRAIS_INTERLIGACAO:
        var nome = "";
        for (
          var i = POSICAO.POSICAO_MENSAGEM_INTERLIGACAO_ENVIA_NOME_CENTRAIS;
          i <
          POSICAO.POSICAO_MENSAGEM_INTERLIGACAO_ENVIA_NOME_CENTRAIS +
          CONFIG.NR_LOCAL_INSTALACAO;
          i++
        ) {
          nome += String.fromCharCode(data[i]);
        }

        var modelo =
          data[
          POSICAO.POSICAO_MENSAGEM_INTERLIGACAO_ENVIA_NOME_MODELO_CENTRAIS
          ];
        var endereco =
          data[POSICAO.POSICAO_MENSAGEM_INTERLIGACAO_ENVIA_ENDERECO_CENTRAIS];

        obj = {
          event: "udp_nome_e_modelo",
          data: {
            endereco: endereco,
            nome: nome,
            modelo: modelos_centrais[modelo],
          },
        };

        break;

      case COMANDO.COMANDO_ENVIA_STATUS_CENTRAIS_INTERLIGACAO:
        var status = {
          alarme: Buffer.from(
            data.slice(
              POSICAO.POSICAO_MENSAGEM_CONTADOR_ALARME,
              POSICAO.POSICAO_MENSAGEM_CONTADOR_FALHA
            )
          ).readUInt16LE(),
          falha: Buffer.from(
            data.slice(
              POSICAO.POSICAO_MENSAGEM_CONTADOR_FALHA,
              POSICAO.POSICAO_MENSAGEM_CONTADOR_SUPERVISAO
            )
          ).readUInt16LE(),
          supervisao: Buffer.from(
            data.slice(
              POSICAO.POSICAO_MENSAGEM_CONTADOR_SUPERVISAO,
              POSICAO.POSICAO_MENSAGEM_CONTADOR_BLOQUEIO
            )
          ).readUInt16LE(),
          bloqueio: Buffer.from(
            data.slice(
              POSICAO.POSICAO_MENSAGEM_CONTADOR_BLOQUEIO,
              POSICAO.POSICAO_MENSAGEM_CONTADOR_REGRAS
            )
          ).readUInt16LE(),
          regrasTemporizando: Buffer.from(
            data.slice(
              POSICAO.POSICAO_MENSAGEM_CONTADOR_REGRAS,
              POSICAO.POSICAO_MENSAGEM_CONTADOR_STATUS_LED
            )
          ).readUInt8(),
        };

        var leds = {
          fonteOperando:
            parserConfig.getBitInByteHigh(
              data[POSICAO.POSICAO_MENSAGEM_CONTADOR_STATUS_LED_2],
              POSICAO.SHIFT_STATUS_CENTRAL_INTERLIGACAO_FONTE_OPERANDO
            ) === 1,
          fonteFalha:
            parserConfig.getBitInByteHigh(
              data[POSICAO.POSICAO_MENSAGEM_CONTADOR_STATUS_LED_2],
              POSICAO.SHIFT_STATUS_CENTRAL_INTERLIGACAO_FONTE_FALHA
            ) === 1,
          centralSilenciada:
            parserConfig.getBitInByteHigh(
              data[POSICAO.POSICAO_MENSAGEM_CONTADOR_STATUS_LED_2],
              POSICAO.SHIFT_STATUS_CENTRAL_INTERLIGACAO_CENTRAL_SILENCIADA
            ) === 1,
          alarmeGeral:
            parserConfig.getBitInByteHigh(
              data[POSICAO.POSICAO_MENSAGEM_CONTADOR_STATUS_LED_2],
              POSICAO.SHIFT_STATUS_CENTRAL_INTERLIGACAO_ALARME_GERAL
            ) === 1,
          sireneBrigada:
            parserConfig.getBitInByteHigh(
              data[POSICAO.POSICAO_MENSAGEM_CONTADOR_STATUS_LED_2],
              POSICAO.SHIFT_STATUS_INTERLIGACAO_SIRENE_BRIGADA
            ) === 1,
          lacoOperando:
            parserConfig.getBitInByteHigh(
              data[POSICAO.POSICAO_MENSAGEM_CONTADOR_STATUS_LED_2],
              POSICAO.SHIFT_STATUS_INTERLIGACAO_CENTRAL_PLACA_LACO_OPERACAO
            ) === 1 ||
            parserConfig.getBitInByteHigh(
              data[POSICAO.POSICAO_MENSAGEM_CONTADOR_STATUS_LED_2],
              POSICAO.SHIFT_STATUS_INTERLIGACAO_CENTRAL_PLACA_LACO_OPERACAO + 1
            ) === 1,
          regrasTemporizando:
            parserConfig.getBitInByteHigh(
              data[POSICAO.POSICAO_MENSAGEM_CONTADOR_STATUS_LED_2],
              POSICAO.SHIFT_STATUS_INTERLIGACAO_CENTRAL_REGRAS_TEMPORIZANDO
            ) === 1,
          sireneContinua:
            parserConfig.getBitInByteHigh(
              data[POSICAO.POSICAO_MENSAGEM_CONTADOR_STATUS_LED],
              POSICAO.SHIFT_STATUS_CENTRAL_INTERLIGACAO_SIRENE_CONTINUA
            ) === 1,
          sirenePulsada:
            parserConfig.getBitInByteHigh(
              data[POSICAO.POSICAO_MENSAGEM_CONTADOR_STATUS_LED],
              POSICAO.SHIFT_STATUS_CENTRAL_INTERLIGACAO_SIRENE_PULSADA
            ) === 1,
          sireneSilenciada:
            parserConfig.getBitInByteHigh(
              data[POSICAO.POSICAO_MENSAGEM_CONTADOR_STATUS_LED],
              POSICAO.SHIFT_STATUS_CENTRAL_INTERLIGACAO_SIRENE_SILENCIADA
            ) === 1,
        };

        obj = {
          event: "udp_status",
          data: { status: status, leds: leds },
        };

        break;

      case COMANDO.COMANDO_ENVIA_EVENTOS_INDIVIDUAL_INTERLIGACAO_CENTRAL:
        var evento = parserConfig.unparseLogsUdp(data.slice(2));
        evento.tipo_evento = data[1];
        evento.numero = Buffer.from([data[2], data[3]]).readUInt16LE();
        obj = { event: "udp_evento", data: evento };

        break;

      case COMANDO.COMANDO_ENVIA_REGISTROS_INTERLIGACAO_CENTRAL:
        var evento = parserConfig.unparseLogsUdp(data.slice(2));
        evento.tipo_evento = data[1];
        evento.numero = Buffer.from([data[2], data[3]]).readUInt16LE();
        obj = { event: "udp_log", data: evento };

        break;

      case COMANDO.COMANDO_ENVIA_REGRAS_INTERLIGACAO_CENTRAL:
        var regra = {};
        regra.endereco = data[POSICAO.POSICAO_REGRA_RAM_NUMERO];
        regra.numero =
          data[POSICAO.POSICAO_MENSAGEM_REGRAS_CENTRAIS_POSICAO_REGRA];

        var nome = "";
        for (
          var i = POSICAO.POSICAO_MENSAGEM_REGRAS_CENTRAIS_NOME_REGRA;
          i < POSICAO.POSICAO_MENSAGEM_REGRAS_CENTRAIS_CRC_REGRAS;
          i++
        ) {
          nome += String.fromCharCode(data[i]);
        }

        regra.valorTimer = Buffer.from(
          data.slice(
            POSICAO.POSICAO_REGRA_RAM_VALOR_TIMER,
            POSICAO.POSICAO_REGRA_RAM_VALOR_TIMER + TAMANHO.uint32_t
          )
        ).readUInt32LE();
        regra.nome = nome;
        regra.quantidade =
          data[POSICAO.POSICAO_MENSAGEM_REGRAS_CENTRAIS_QUANTIDADE_REGRAS];
        regra.bloqueado =
          parserConfig.getBitInByteLow(
            data[POSICAO.POSICAO_REGRA_RAM_BLOQUEADO],
            POSICAO.POSICAO_REGRA_RAM_BLOQUEADO_BIT
          ) === 1;

        var now = new Date();
        now.setHours(0, 0, 0, 0);
        now.setSeconds(now.getSeconds() + regra.valorTimer - 1);
        regra.date = now;

        obj = { event: "udp_regra", data: regra };

        if (regra.endereco === 255) {
          obj.event = "udp_regra_todos";
        }

        break;

      case COMANDO.COMANDO_ENVIA_ZONAS_INTERLIGACAO_CENTRAL:
        var zona = {};

        zona.endereco = data[POSICAO.POSICAO_ZONA_RAM_ENDERECO];
        zona.numero =
          data[POSICAO.POSICAO_MENSAGEM_ZONAS_CENTRAIS_POSICAO_ZONA];

        var nome = "";
        for (
          var i = POSICAO.POSICAO_MENSAGEM_ZONAS_CENTRAIS_NOME_ZONA;
          i < POSICAO.TAMANHO_MENSAGEM_ZONAS_CENTRAIS;
          i++
        ) {
          nome += String.fromCharCode(data[i]);
        }

        zona.nome = nome;
        zona.bloqueado =
          parserConfig.getBitInByteLow(
            data[POSICAO.POSICAO_ZONA_RAM_BLOQUEADO],
            POSICAO.POSICAO_ZONA_RAM_BLOQUEADO_BIT
          ) === 1;

        obj = { event: "udp_zona", data: zona };

        if (zona.endereco === 255) {
          obj.event = "udp_zona_todos";
        }

        break;

      case COMANDO.COMANDO_ENVIA_DISPOSITIVOS_INTERLIGACAO_CENTRAL:
        var dispositivo = {};
        dispositivo.endereco = data[POSICAO.POSICAO_DISPOSITIVO_RAM_ENDERECO];
        dispositivo.numero =
          data[
          POSICAO.POSICAO_MENSAGEM_DISPOSITIVOS_CENTRAIS_POSICAO_DISPOSITIVO
          ];

        var nome = "";
        for (
          var i =
            POSICAO.POSICAO_MENSAGEM_DISPOSITIVOS_CENTRAIS_NOME_DISPOSTIVO;
          i < POSICAO.POSICAO_MENSAGEM_DISPOSITIVOS_CENTRAIS_QUANTIDADE_FILTRO;
          i++
        ) {
          nome += String.fromCharCode(data[i]);
        }

        dispositivo.ativo =
          Buffer.from([
            parserConfig.getBitInByteLow(
              data[POSICAO.POSICAO_MENSAGEM_DISPOSITIVOS_CENTRAIS_DISPOSITIVO],
              POSICAO.POSICAO_DISPOSITIVO_RAM_ATIVO_BIT_1
            ),
            parserConfig.getBitInByteLow(
              data[POSICAO.POSICAO_MENSAGEM_DISPOSITIVOS_CENTRAIS_DISPOSITIVO],
              POSICAO.POSICAO_DISPOSITIVO_RAM_ATIVO_BIT_2
            ),
          ]).readUInt16LE() > 0;
        dispositivo.nome = nome;
        dispositivo.bloqueado =
          parserConfig.getBitInByteLow(
            data[POSICAO.POSICAO_MENSAGEM_DISPOSITIVOS_CENTRAIS_DISPOSITIVO],
            POSICAO.POSICAO_DISPOSITIVO_RAM_BLOQUEADO_BIT
          ) === 1;

        obj = { event: "udp_dispositivo", data: dispositivo };

        if (dispositivo.endereco === 255) {
          obj.event = "udp_dispositivo_todos";
        }

        break;

      case COMANDO.COMANDO_ENVIA_LACOS_INTERLIGACAO_CENTRAL:
        var lacos = [];
        if (data[POSICAO.POSICAO_LACO_1] === 1) {
          lacos.push({
            nome: "Laço 1",
            bloqueado: data[POSICAO.POSICAO_LACO_1 + 1] === 1,
            endereco: 1,
          });
        }
        if (data[POSICAO.POSICAO_LACO_2] === 2) {
          lacos.push({
            nome: "Laço 2",
            bloqueado: data[POSICAO.POSICAO_LACO_2 + 1] === 1,
            endereco: 2,
          });
        }
        obj = { event: "udp_laco", data: lacos };

        break;

      case COMANDO.COMANDO_ENVIA_CRC_REGRAS_INTERLIGACAO_CENTRAL:
        var crc = Buffer.from(data.slice(1, TAMANHO.uint32_t)).readUInt16LE();
        obj = { event: "udp_crc_regras_temporizando", data: crc };

        break;

      case COMANDO.COMANDO_COMUNICACAO_PROGRAMADOR_AUTENTICACAO_REMOTA_RESPOSTA_SESSAO:
        var token = Buffer.from(data.slice(1, TAMANHO.uint32_t + 1));
        obj = { event: "udp_autenticacao", data: { token: token } };

        break;

      case COMANDO.COMANDO_COMUNICACAO_PROGRAMADOR_SESSAO_INVALIDA:
        //console.log("COMANDO_COMUNICACAO_PROGRAMADOR_SESSAO_INVALIDA");
        obj = { event: "udp_nak" };

        break;

      case COMANDO.COMANDO_ACK_COMANDOS_INTERLIGACAO_CENTRAL:
        obj = {
          event: "udp_enviar_comando",
          data: { resposta: RESPOSTA.COMANDO_BOTAO[data[3]] },
        };

        break;

      case COMANDO.COMANDO_ACK_COMANDOS_BLOQUEIOS_SAIDAS_INTERLIGACAO_CENTRAL:
        // console.log("COMANDO_ACK_COMANDOS_BLOQUEIOS_SAIDAS_INTERLIGACAO_CENTRAL", data);
        obj = { event: "udp_bloquear", data: { numero: data[3] } };

        break;

      case COMANDO.COMANDO_ACK_COMANDOS_SAIDAS_INTERLIGACAO_CENTRAL:
        obj = { event: "udp_ativar_saida", data: {} };

        break;

      case COMANDO.COMANDO_ENVIA_CONTADORES_BLOQUEIOS_INTERLIGACAO_CENTRAL:
        var counters = {
          dispositivo:
            Buffer.from([data[1], data[2]]).readUInt16LE() - data[12], //total de dispositivos - dispositivos laco 0
          sirene: Buffer.from([data[3], data[4]]).readUInt16LE(),
          saida: Buffer.from([data[5], data[6]]).readUInt16LE(),
          atuador: Buffer.from([data[7], data[8]]).readUInt16LE(),
          regra: data[9],
          zona: data[10],
          laco: data[11],
          dispositivoLaco0: data[12],
          dispositivoLaco1: data[13],
          dispositivoLaco2: data[14],
          saidaLaco0: data[15],
          saidaLaco1: data[16],
          saidaLaco2: data[17],
          sireneLaco0: data[18],
          sireneLaco1: data[19],
          sireneLaco2: data[20],
          atuadorLaco0: data[21],
          atuadorLaco1: data[22],
          atuadorLaco2: data[23],
        };

        obj = { event: "udp_bloqueios_contadores", data: counters };

        break;

      case COMANDO.COMANDO_ENVIA_CONTADORES_SAIDAS_INTERLIGACAO_CENTRAL:
        var counters = {
          saidaLaco0: data[1],
          saidaLaco1: data[2],
          saidaLaco2: data[3],
          sireneLaco0: data[4],
          sireneLaco1: data[5],
          sireneLaco2: data[6],
          atuadorLaco0: data[7],
          atuadorLaco1: data[8],
          atuadorLaco2: data[9],
        };
        counters.saida =
          counters.saidaLaco0 + counters.saidaLaco1 + counters.saidaLaco2;
        counters.sirene =
          counters.sireneLaco0 + counters.sireneLaco1 + counters.sireneLaco2;
        counters.atuador =
          counters.atuadorLaco0 + counters.atuadorLaco1 + counters.atuadorLaco2;

        obj = { event: "udp_saidas_contadores", data: counters };

        break;

      case COMANDO.COMANDO_ENVIA_INFORMACOES_CENTRAL_INTERLIGACAO_CENTRAL:
        var counters = {
          dispositivoLaco0: data[1],
          dispositivoLaco1: data[2],
          dispositivoLaco2: data[3],
          saidaLaco0: data[4],
          saidaLaco1: data[5],
          saidaLaco2: data[6],
          sireneLaco0: data[7],
          sireneLaco1: data[8],
          sireneLaco2: data[9],
          atuadorLaco0: data[10],
          atuadorLaco1: data[11],
          atuadorLaco2: data[12],
          regra: data[13],
          zona: data[14],
        };

        obj = { event: "udp_info", data: counters };

        break;

      case COMANDO.NAK_COMANDO_INVALIDO:
        switch (data[1]) {
          case COMANDO.COMANDO_COMUNICACAO_PROGRAMADOR_AUTENTICACAO_REMOTA:
            //console.log(data);
            //console.log("COMANDO_COMUNICACAO_PROGRAMADOR_AUTENTICACAO_REMOTA");
            obj = {
              event: "udp_autenticacao",
              data: { fail: true },
            };

            break;

          default:
            //console.log(data);
            //console.log("NAK_COMANDO_INVALIDO default");
            obj = { event: "udp_nak" };

            break;
        }

        break;

      default:
        //console.log(data);
        //console.log("NAK_COMANDO_INVALIDO master default");
        obj = { event: "udp_invalid_command" };

        break;
    }

    return obj;
  },
};

function arrayToIp(array, position) {
  return (
    array[position] +
    "." +
    array[position + 1] +
    "." +
    array[position + 2] +
    "." +
    array[position + 3]
  );
}

function toInt(data, start, stop) {
  var array = [];
  for (var i = start; i <= stop; i++) {
    array.push(data[i]);
  }
  var Uint8Arr = new Uint8Array(array);
  var length = Uint8Arr.length;
  var buffer = Buffer.from(Uint8Arr);
  var result = buffer.readUIntLE(0, length);
  return result;
}

function toDate(data) {
  var POSICAO = CONFIG.POSICAO;
  return new Date(
    data[POSICAO.POSICAO_MENSAGEM_INTERLIGACAO_SINCRONIZACAO_RTC_ANO],
    data[POSICAO.POSICAO_MENSAGEM_INTERLIGACAO_SINCRONIZACAO_RTC_MES] - 1,
    data[POSICAO.POSICAO_MENSAGEM_INTERLIGACAO_SINCRONIZACAO_RTC_DIA],
    data[POSICAO.POSICAO_MENSAGEM_INTERLIGACAO_SINCRONIZACAO_RTC_HORA],
    data[POSICAO.POSICAO_MENSAGEM_INTERLIGACAO_SINCRONIZACAO_RTC_MINUTO],
    data[POSICAO.POSICAO_MENSAGEM_INTERLIGACAO_SINCRONIZACAO_RTC_SEGUNDO]
  );
}

function concatTypedArrays(a, b) {
  // a, b TypedArray of same type
  var c = new a.constructor(a.length + b.length);
  c.set(a, 0);
  c.set(b, a.length);
  return c;
}

function pad(n) {
  return n.length < 2 ? "0" + n : n;
}

function padAddr(n) {
  return n.length < 3 ? "0" + n : n;
}
