/**
 * Criado por Livecom on 3/19/2016.
 * Contato: contato@livecom.io
 * Site: http://livecom.io
 */
var defaultConfig = {
  COMMAND_TIMEOUT: 300,
  DEFAULT_TCP_PORT: 12347,
  PING_INTERVAL: 1000,
  CIE_commands: {
    BLOCKED_CONNECTION: 255,
    PING: 99,
    CONNECTION_ESTABLISHED: 1,
    SEND_DEVICE_FRAME: 2,
    DEVICE_FRAME_RECEIVED: 3,
    DEVICE_CONFIG_ENDS: 4,
    SEND_ZONE_FRAME: 5,
    ZONE_FRAME_RECEIVED: 6,
    ZONE_CONFIG_ENDS: 13,
    SEND_RULE_FRAME: 7,
    RULE_FRAME_RECEIVED: 11,
    RULE_CONFIG_ENDS: 14,
    SEND_RULE_ITEM_FRAME: 8,
    RULE_ITEM_FRAME_RECEIVED: 12,
    RULE_ITEM_CONFIG_ENDS: 19,
    ALL_CONFIG_RECEIVED: 9,
    ALL_CONFIG_SENT: 10,
    SEND_SYSTEM_FRAME: 15,
    SYSTEM_FRAME_RECEIVED: 16,
    LOGS_FRAME_RECEIVED: 24,
    ALL_LOGS_RECEIVED: 25,
    GET_DATE: 26,
    DATE_SET: 27,
    RESET_CONFIG: 28,
    RESET_LOGS: 29,
    GET_INFO: 32,
    SEND_LOOP_FRAME: 33,
    LOOP_FRAME_RECEIVED: 34,
    GET_LOOP_SCAN: 35,
    END_LOOP_SCAN: 36,
    CALL_LOOP_SCAN: 37,
    BLOCK: 38,
    SEND_FIRMWARE: 39,
    FIRMWARE_FINISHED: 40,
    DEVELOPER_MODE: 41,
    FLASH_DUMP: 42,
    GET_CRE_CONFIG: 43,
    SEND_CRE_CONFIG: 44,
    GET_NETWORK_BOARD_CONFIG: 45,
    GET_GATEWAY_ERRORS: 48,
    SET_GATEWAY_RESET: 49,
    NAK_NETWORK: 128,
    SET_GATEWAY_INFO: 50,
    GET_GATEWAY_INFO: 51,
    SET_MODBUS_INFO: 52,
    GET_MODBUS_INFO: 53,
    SET_PROG_SITUATOR_INFO: 54,
    GET_PROG_SITUATOR_INFO: 55,
    SET_SITUATOR_LOGIN: 56,
    GET_SITUATOR_LOGIN: 57,
    SET_SITUATOR_TOKEN: 58,
    GET_SITUATOR_TOKEN: 59,
    SET_SITUATOR_HOST: 60,
    GET_SITUATOR_HOST: 61,
    SET_WEBHOOK_INFO: 62,
    GET_WEBHOOK_INFO: 63,
    SET_WEBHOOK_HMAC_PRIVKEY: 64,
    GET_WEBHOOK_HMAC_PRIVKEY: 65,
    SET_WEBHOOK_HOST: 66,
    GET_WEBHOOK_HOST: 67,
    SET_WEBHOOK_ENDPOINT: 68,
    GET_WEBHOOK_ENDPOINT: 69,
    SET_SSLTLS_ROOT_CA: 70,
    GET_SSLTLS_ROOT_CA: 71,
    SET_SSLTLS_SELF_CERT: 72,
    GET_SSLTLS_SELF_CERT: 73,
    SET_SSLTLS_SELF_CERT_PK: 74,
    GET_SSLTLS_SELF_CERT_PK: 75,
    PROG_DEL_SSLTLS: 76,
    SET_RCPTIP_INFO: 77,
    GET_RCPTIP_INFO: 78,
    SET_RCPTIP_HOST: 79,
    GET_RCPTIP_HOST: 80,
    SET_GATEWAY_ADVANCED_CMDS: 90,
    SET_GATEWAY_MAC: 91,
    SET_GATEWAY_RESET_FABRICA: 92,
    SET_GATEWAY_ERASE_EVENTS: 93,
    SET_GATEWAY_FLASH_WIPE: 94,
    SET_GATEWAY_FLASH_DUMP: 95,
    SET_GATEWAY_AUTH_ETH: 96,
    GET_GATEWAY_LOG: 98,
  },

  connectionsMode: { USB: "usb", NETWORK: "network", WIFI: "wifi" },

  firmwareDevVersion: "ifireintelbras",

  loop: {
    config: 1,
    id: 2,
    blocked: 3,
    qty: 4,
    offset: 2,
  },

  // device configuration frame 128 bytes
  // position  |  value
  //    0      |  HID first byte communication must be 0x00
  //    1      |  configuration byte
  //    2      |  if the configuration of a loop ends
  //    3      |  loop
  //    4      |  loop_enable
  //    5      |  device address
  //    6      |  device type
  //    7      |  device subtype
  //    8      |  device zone
  //    9      |  device enable
  //    10     |  device supervision
  //  11 - 24  |  device device name
  //  62 - 63  |  not allocated
  device: {
    qty: 3, //quantidade de dispositivos enviados em um frame de 128 bytes
    offset: 33, //offset entre configurações dos dispositivos no mesmo frame
    config: 1, //comando de configuracao
    end_config: 2, //byte que indica quando uma configuração de dispositivos foi encerrada
    loop: 3,
    address: 4,
    type: 5,
    subtype: 6,
    zone: 7,
    enable: 8,
    supervision: 9,
    name_start: 10,
    name_length: 14,
    rule_mask: 24,
    rule_mask_length: 13,
  },

  // zone configuration frame 128 bytes
  // position |  value
  //    0     |  HID first byte communication must be 0x00
  //    1     |  configuration byte
  //    2     |  if the configuration of a zone ends
  //    3     |  zone id
  //    4     |  enable
  //  5 - 20  |  zone name
  //    21    |  zone id
  //    22    |  enable
  //  23 - 38 |  zone name
  //    39    |  zone id
  //    40    |  enable
  //  41 - 56 |  device subtype
  //  58 - 63 |  not allocated
  zone: {
    qty: 4, //quantidade de zonas enviadas em um frame de 128 bytes
    offset: 31, //offset entre configurações das zonas no mesmo frame
    config: 1, //comando de configuracao
    end_config: 2, //byte que indica quando uma configuração de zonas foi encerrada
    id: 3,
    enable: 4,
    name_start: 5,
    name_length: 16,
    rule_mask_length: 13,
    rule_mask: 21,
  },

  // rule configuration frame 128 bytes
  // position |  value
  //    0     |  HID first byte communication must be 0x00
  //    1     |  configuration byte
  //    2     |  if the configuration of a rule ends
  //    3     |  rule id
  //    4     |  enable
  //  5 - 18  |  rule name
  //    19    |  rule type
  //    20    |  timer minutes
  //    21    |  timer seconds
  //    22    |  brigade
  //    23    |  alarm
  //    24    |  items quantity (devices,zones or events) byte 1
  //    25    |  items quantity (devices,zones or events) byte 2
  //    26    |  input_condition
  //    27    |  activation_output
  //    28    |  cancelable

  rule: {
    qty: 4, //quantidade de itens enviados em um frame de 128 bytes
    offset: 26, //offset entre configurações das zonas no mesmo frame
    config: 1, //comando de configuracao
    end_config: 2, //byte que indica quando uma configuração de regra foi encerrada
    id: 3,
    enable: 4,
    name_start: 5,
    name_length: 14,
    rule_type: 19,
    minutes: 20,
    seconds: 21,
    brigade: 22,
    alarm: 23,
    items_count_byte1: 24,
    items_count_byte2: 25,
    input_condition: 26,
    activation_output: 27,
    cancelable: 28,
  },

  // rule_items configuration frame 128 bytes
  // position |  value
  //    0     |  HID first byte communication must be 0x00
  //    1     |  configuration byte
  //    2     |  if the configuration of a rule ends
  //    3     |  rule id
  //    4    |  device,zone or event mode (input or output)
  //    5    |  device,zone or event class (0 if device or event, 1 if zone)
  //    6    |  board number
  //    7    |  device,zone or event loop (0 if event or zone, 1 to 4 if devices)
  //    8    |  id
  //    9    |  device,zone or event mode (input or output)
  //    10    |  device,zone or event class (0 if device or event, 1 if zone)
  //    11    |  board number
  //    12    |  device,zone or event loop (0 if event or zone, 1 to 4 if devices)
  //    13    |  id
  //    14    |  device,zone or event mode (input or output)
  //    15    |  device,zone or event class (0 if device or event, 1 if zone)
  //    16    |  board number
  //    17    |  device,zone or event loop (0 if event or zone, 1 to 4 if devices)
  //    18    |  id
  //    19    |  device,zone or event mode (input or output)
  //    20    |  device,zone or event class (0 if device or event, 1 if zone)
  //    21    |  board number
  //    22    |  device,zone or event loop (0 if event or zone, 1 to 4 if devices)
  //    23    |  id
  //    24    |  device,zone or event mode (input or output)
  //    25    |  device,zone or event class (0 if device or event, 1 if zone)
  //    26    |  board number
  //    27    |  device,zone or event loop (0 if event or zone, 1 to 4 if devices)
  //    28    |  id
  //    29    |  device,zone or event mode (input or output)
  //    30    |  device,zone or event class (0 if device or event, 1 if zone)
  //    31    |  board number
  //    32    |  device,zone or event loop (0 if event or zone, 1 to 4 if devices)
  //    33    |  id
  //    34    |  device,zone or event mode (input or output)
  //    35    |  device,zone or event class (0 if device or event, 1 if zone)
  //    36    |  board number
  //    37    |  device,zone or event loop (0 if event or zone, 1 to 4 if devices)
  //    38    |  id
  //    39    |  device,zone or event mode (input or output)
  //    40    |  device,zone or event class (0 if device or event, 1 if zone)
  //    41    |  board number
  //    42    |  device,zone or event loop (0 if event or zone, 1 to 4 if devices)
  //    43    |  id
  //    44    |  device,zone or event mode (input or output)
  //    45    |  device,zone or event class (0 if device or event, 1 if zone)
  //    46    |  board number
  //    47    |  device,zone or event loop (0 if event or zone, 1 to 4 if devices)
  //    48    |  id
  //    49    |  device,zone or event mode (input or output)
  //    50    |  device,zone or event class (0 if device or event, 1 if zone)
  //    51    |  board number
  //    52    |  device,zone or event loop (0 if event or zone, 1 to 4 if devices)
  //    53    |  id
  //    54    |  device,zone or event mode (input or output)
  //    55    |  device,zone or event class (0 if device or event, 1 if zone)
  //    56    |  board number
  //    57    |  device,zone or event loop (0 if event or zone, 1 to 4 if devices)
  //    58    |  id
  //    59    |  device,zone or event mode (input or output)
  //    60    |  device,zone or event class (0 if device or event, 1 if zone)
  //    61    |  board number
  //    62    |  device,zone or event loop (0 if event or zone, 1 to 4 if devices)
  //    63    |  id
  rule_items: {
    qty: 25, //quantidade de itens enviados em um frame de 128 bytes
    offset: 5, //offset entre configurações das zonas no mesmo frame
    config: 1, //comando de configuracao
    end_config: 2, //byte que indica quando uma configuração de regra foi encerrada
    rule_id: 3,
    item_mode: 4,
    item_class: 5,
    board_number: 6,
    item_loop: 7,
    item_id: 8,
  },

  // system configuration frame 128 bytes
  // position |  value
  //    0     |  HID first byte communication must be 0x00
  //    1     |  configuration byte
  //    2     |  if the configuration of a rule ends
  //    3     |  firmware version
  //    4     |  firmware release
  //    5     |  firmware fix
  //    6     |  central model
  //   7-19   |  production batch
  //    20    |  net address
  //  21-41   |  installation place
  //  42-47   |  password level 2
  //  48-53   |  password level 3
  //  54-59   |  password level 4
  //    60    |  operation mode
  //    61    |  delay minutes
  //    62    |  delay seconds
  //    63    |  not allocated
  system: {
    config: 1,
    end_config: 2,
    mac_addr: 4,
    net_add: 10,
    installation: 11,
    installation_length: 22,
    password_2: 33,
    password_3: 39,
    password_4: 45,
    password_length: 6,
    operation_mode: 51,
    delay_min: 52,
    delay_sec: 53,
    repeaters: 69, //inicio do array de repetidoras ativadas, com tamanho 4
    cre_id: 73,
    enabled_cies: 74, //inicio do array de centrais habilitadas ativadas, com tamanho 16
    cie_restart: 90,
    general_alarm: 91,
    brigade_siren: 92,
    silence_siren: 93,
    dhcp: 94,
    ip: 95, //int32
    mask: 99, //int32
    gateway: 103, //int32
    external_battery: 107,
    silence_central: 108,
    has_network_board: 109,
    pre_alarm: 110,
    modbus: 111,
    p2p: 112,
    gw521: 113,
  },

  system_std_out: {
    alarm_blocked: 54,
    alarm_loop: 55,
    alarm_address: 56,
    alarm_delay_min: 57,
    alarm_delay_sec: 58,
    fault_blocked: 59,
    fault_loop: 60,
    fault_address: 61,
    fault_delay_min: 62,
    fault_delay_sec: 63,
    sup_blocked: 64,
    sup_loop: 65,
    sup_address: 66,
    sup_delay_min: 67,
    sup_delay_sec: 68,
  },

  log: {
    events: {
      0: {
        name: "Alarme",
        label: "alarme",
      },
      1: {
        name: "Falha",
        label: "falha",
      },
      2: {
        name: "Supervisão",
        label: "supervisao",
      },
      3: {
        name: "Operação",
        label: "operacao",
      },
    },
    offset: 56,
    qty: 2,
    log_type: 2,
    log_id: 3,
    source: 4,
    board_number: 5,
    loop: 6,
    address: 7,
    device_name: 8,
    device_name_length: 14,
    zone: 22,
    zone_name: 23,
    zone_name_length: 16,
    first_event: 39,
    rule_activation: 40,
    event_type: 41,
    day: 42,
    month: 43,
    year: 44,
    hour: 45,
    minutes: 46,
    seconds: 47,
    device_blocked: 48,
    device_type: 49,
    device_subtype: 50,
    sequence: 51,
    repeater_addr: 55,
  },

  eventsUdp: {
    events: {
      0: {
        name: "Alarme",
        label: "alarme",
      },
      1: {
        name: "Falha",
        label: "falha",
      },
      2: {
        name: "Supervisão",
        label: "supervisao",
      },
      3: {
        name: "Operação",
        label: "operacao",
      },
    },

    qty: 1,
    type_event: 1,
    log_id: 2,
    zone: 4,
    first_event: 6,
    event_type: 7,
    address: 8,
    device_type: 9,
    day: 10,
    month: 11,
    year: 12,
    hour: 13,
    minutes: 14,
    seconds: 15,
    loop: { p: 16, start: 0, end: 2 },
    repeater_addr: { p: 16, start: 2, end: 5 },
    //LogRegra 2 bits
    device_blocked: { p: 16, start: 7, end: 8 },
    device_subtype: { p: 17, start: 0, end: 3 },
    source: { p: 17, start: 3, end: 8 },
    device_name: 18,
    device_name_length: 14,
    zone_name: 33,
    zone_name_length: 15,
    sequence: 49,
    length_of_type: 54,
  },

  info: {
    version: 1,
    release: 2,
    revision: 3,
    central_model: 4,
    batch: 5,
    batch_length: 14,
    power_supply_version: 19,
    power_supply_release: 20,
    power_supply_revision: 21,
    loop_version: 22,
    loop_release: 23,
    protocol_version: 24,
    protocol_release: 25,
    central_model_on_rp: 26,
    mac_addr: 27, //array 6 bytes
    ip: 33, //4 bytes
    mask: 37, //4 bytes
    gateway: 41, //4 bytes
    networkMode: 45,
  },

  loop_scan: {
    qty: 120,
    config: 1,
    loop: 3,
    end_config: 2,
  },

  firmware: {
    qty: 120,
    start: 3,
  },

  dispositivos_locais: ["10", "20", "13", "16", "17", "18", "19"],

  dispositivos_locais_nomes: {
    10: "S1",
    20: "S2",
    13: "S3",
    16: "R1",
    17: "R2",
    18: "R3",
    19: "R4",
  },

  entradas_interligacao: [
    25, 26, 27, 28, 29, 30, 31, 32, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43,
    44, 45, 46, 47, 48, 49, 50, 51, 52, 53, 54, 55, 56, 57, 58, 59, 60, 61, 62,
    63, 64, 65, 66, 67, 68, 69, 70, 71, 72, 73, 74, 75,
  ],

  modelos_centrais: {
    CIE1060: {
      id: "CIE1060",
      nome: "Central CIE 1060",
      QTD_LACOS: 1,
      QTD_DISPOSITIVOS_LACO: 60,
      is1060: true,
    },
    CIE1125: {
      id: "CIE1125",
      nome: "Central CIE 1125",
      QTD_LACOS: 1,
      QTD_DISPOSITIVOS_LACO: 125,
    },
    CIE1250: {
      id: "CIE1250",
      nome: "Central CIE 1250",
      QTD_LACOS: 1,
      QTD_DISPOSITIVOS_LACO: 250,
    },
    CIE2500: {
      id: "CIE2500",
      nome: "Central CIE 2500",
      QTD_LACOS: 2,
      QTD_DISPOSITIVOS_LACO: 250,
    },
    CIE41000: {
      id: "CIE41000",
      nome: "Central CIE 41000",
      QTD_LACOS: 4,
      QTD_DISPOSITIVOS_LACO: 250,
    },
    VIRGEM: {
      id: "VIRGEM",
      nome: "VIRGEM",
      QTD_LACOS: 0,
      QTD_DISPOSITIVOS_LACO: 0,
    },
    REPEATER: {
      id: "REPEATER",
      nome: "Repetidora RP 520",
      isRepeater: true,
    },
    GATEWAY: {
      id: "GATEWAY",
      nome: "Gateway CIE GW521",
      isGateway: true,
    },
  },

  udp: {
    PORT: 12345,
    IPV4_GROUP: "239.255.55.55",
  },

  gateway: {
    rede: {
      modo_ip: 2,
      tipo_integracao: 3,
      is_ipv6: 4,
      ip_fixo: 5,
      ip_fixo_length: 16,
      net_mask: 21,
      net_mask_length: 16,
      gateway: 37,
      gateway_length: 16,
      dns_1: 53,
      dns_1_length: 16,
      dns_2: 69,
      dns_2_length: 16,
      pwd_prog_cie: 85,
      pwd_prog_cie_length: 20,
    },
    modbus: {
      porta: 2,
      unity_id: 4,
      client_timeout: 5,
    },
    situador: {
      account_code: 2,
      auth_by: 6,
      tempo_entre_eventos: 7,
      hearbeat: 9,
      zone_code: 13,
      ignore_events: 42,
      Language: 51,
    },
    situador_login: {
      user: 2,
      password: 52,
    },
    situador_token: {
      token: 2,
    },
    situador_host: {
      is_https: 2,
      is_host_ip: 4,
      port: 5,
      hostname: 7,
    },
    webhook_info: {
      UserCode: 2,
      TempoEntreEventos: 6,
      HeartbeatTime: 8,
      IgnoredEvents: 12,
      Language: 20,
    },
    hmac_pk: {
      pkKey: 2,
    },
    webhook_host: {
      isHTTPs: 2,
      HttpsAuthType: 3,
      isHostIP: 4,
      Porta: 5,
      Host: 7,
    },
    webhook_endpoint: {
      Endpoint: 2,
    },
    rcptip_host: {
      // not implemented
      isHTTPs: 0,
      HttpsAuthType: 0,

      isHostIP: 4,
      Porta: 5,
      Host: 7,
    },
    rcptip_info: {
      AccountCode: 2,
      UserCode: 6,
      TempoEntreEventos: 10,
      HeartbeatTime: 12,

      // not implemented
      SubType: 0,
      IgnoredEvents: 0,
    },
    certificate_info: {
      valid_from: 2,
      valid_to: 9,
      serial_number: 22,
      issuer: 38,
      subject: 78,
    },
    errors: {
      sistema: 2,
      flashExterna: 3,
      ethernet: 4,
      comunicacao: 5,
      modbus: 6,
      situador: 7,
      webhook: 8,
      rcptip: 9,
    },
  },

  tipo_integracao_values: {
    desabilitada: 0,
    situador: 1,
    modbusTCP: 2,
    webhook: 3,
    rcptip: 4,
  },

  tipo_integracao_types: {
    0: "desabilitada",
    1: "situador",
    2: "modbusTCP",
    3: "webhook",
    4: "rcptip",
  },
};

var config304 = {
  firmware: {
    qty: 125,
  },
  system: {
    config: 1,
    end_config: 2,
    firmware_version: 3,
    firmware_release: 4,
    firmware_fix: 5,
    central_model: 6,
    production_batch: 7,
    production_batch_length: 13,
    net_add: 20,
    installation: 21,
    installation_length: 21,
    password_2: 42,
    password_3: 48,
    password_4: 54,
    password_length: 6,
    operation_mode: 60,
    delay_min: 61,
    delay_sec: 62,
    repeaters: 81,
    cre_id: 85,
    enabled_cies: 86,
    cie_restart: 102,
    general_alarm: 103,
    brigade_siren: 104,
    silence_siren: 105,
    dhcp: 106,
    ip: 107, //int32
    mask: 111, //int32
    gateway: 116, //int32
    external_battery: 120,
    silence_central: 121,
    has_network_board: 122,
    pre_alarm: 123,
    modbus: 124,
  },
  system_std_out: {
    alarm_blocked: 63,
    alarm_board_number: 64,
    alarm_loop: 65,
    alarm_address: 66,
    alarm_delay_min: 67,
    alarm_delay_sec: 68,
    fault_blocked: 69,
    fault_board_number: 70,
    fault_loop: 71,
    fault_address: 72,
    fault_delay_min: 73,
    fault_delay_sec: 74,
    sup_blocked: 75,
    sup_board_number: 76,
    sup_loop: 77,
    sup_address: 78,
    sup_delay_min: 79,
    sup_delay_sec: 80,
  },
};

module.exports = function (version) {
  try {
    var config = Object.assign({}, defaultConfig);
    if (version) {
      var versionNumber = parseInt(version.replace(/\D/g, ""));
      if (versionNumber < 310) {
        return Object.assign(config, config304);
      }
    }
    return defaultConfig;
  } catch (e) {
    return defaultConfig;
  }
};
