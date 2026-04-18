import { schedule } from '@netlify/functions';
import { sendNotificationToAll } from '../../src/services/notificationService.ts';

export const handler = schedule('0 9 * * *', async (event) => {
  const messages = [
    "¡Buenos días, mi Karin! Hoy el cielo está despejado para ti. ¡A brillar! ✨",
    "¡Hola, mi cielo! Una nueva oportunidad para coleccionar millas brillantes. ¡Tú puedes!",
    "Despierta, mi Karin. Nora está lista para acompañarte hoy. Vamos con todo. ☀️"
  ];
  const message = messages[Math.floor(Math.random() * messages.length)];
  try {
    await sendNotificationToAll('Bitácora de Nora', message);
    return { statusCode: 200 };
  } catch (e) {
    console.error("Scheduled morning error:", e);
    return { statusCode: 500 };
  }
});
