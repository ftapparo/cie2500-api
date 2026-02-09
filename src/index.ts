import { CIE2500Native } from './native/CIE2500Native';

const IP  = process.env.CIE_IP || '192.168.0.4';
const END = Number(process.env.CIE_ENDERECO ?? 0);
const PASS = process.env.CIE_PASSWORD || '444444';

if (process.env.DEBUG_CIE !== '1') {
  const noop = () => {};
  // sobrescreve só o que você não quer ver
  console.log = console.log; // mantém
  console.warn = noop;
  console.error = console.error; // mantém
}


async function main() {
  const cie = new CIE2500Native();

  console.log('>> discover…');
  const list = await cie.discover(true);
  console.log('udp_descobrir:', list);

  console.log('>> authenticate…');
  const token = await cie.authenticate(IP, PASS, END);
  console.log('token:', token.toString('hex'));

  console.log('>> startCommunication…');
  await cie.startCommunication(IP, END, token);

  console.log('nome/modelo:', await cie.nomeModelo(IP, END));
  console.log('mac:',         await cie.mac(IP, END));
  console.log('info:',        await cie.info(IP, END));
  console.log('data/hora:',   await cie.dataHora(IP, END));
  console.log('status:',      await cie.status(IP, END));

  await cie.stopCommunication();
  console.log('OK');
  await cie.shutdown();           // <— adiciona
  process.exit(0);                // opcional (garante saída)
}

main().catch(e => { console.error('erro:', e); process.exit(1); });
