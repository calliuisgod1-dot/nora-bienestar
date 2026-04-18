import { schedule } from '@netlify/functions';
import { sendNotificationToAll } from '../../src/services/notificationService.ts';

export const handler = schedule('0 21 * * *', async (event) => {
  try {
    await sendNotificationToAll(
      'Escala Técnica', 
      '¡Hola, mi cielo! Hora de tu respiración. Vamos a soltar el día juntas. ✨',
      '/?action=breathe'
    );
    return { statusCode: 200 };
  } catch (e) {
    console.error("Scheduled evening error:", e);
    return { statusCode: 500 };
  }
});
