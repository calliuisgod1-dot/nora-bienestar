import webpush from 'web-push';
import admin from 'firebase-admin';

// VAPID keys
const publicVapidKey = process.env.VAPID_PUBLIC_KEY || '';
const privateVapidKey = process.env.VAPID_PRIVATE_KEY || '';

let vapidSet = false;

export const sendNotificationToAll = async (title: string, body: string, url: string = '/') => {
  if (!publicVapidKey || !privateVapidKey) {
    console.warn("VAPID keys not configured for notifications.");
    return;
  }

  if (!vapidSet) {
    try {
      const subject = process.env.VAPID_SUBJECT || 'mailto:calliuisgod1@gmail.com';
      if (subject.startsWith('mailto:') || subject.startsWith('http')) {
        webpush.setVapidDetails(subject, publicVapidKey, privateVapidKey);
        vapidSet = true;
      } else {
        console.error("VAPID Subject invalid format (not a URL/mailto):", subject);
        return; // Skip if subject is invalid
      }
    } catch (error) {
      console.error("Error setting VAPID details:", error);
      return;
    }
  }

  // Ensure Firebase is initialized
  if (!admin.apps.length) {
    console.error("Firebase Admin not initialized in notification service");
    return;
  }

  const firestore = admin.firestore();
  const subscriptionsCol = firestore.collection('push_subscriptions');

  try {
    const snapshot = await subscriptionsCol.get();
    const payload = JSON.stringify({ title, body, url });

    console.log(`[Nora] Enviando mensaje a ${snapshot.size} suscripciones...`);
    
    const promises = snapshot.docs.map(async (doc) => {
      const subscription = doc.data();
      try {
        await webpush.sendNotification(subscription as any, payload);
      } catch (error: any) {
        if (error.statusCode === 410 || error.statusCode === 404) {
          console.log(`[Nora] Limpiando suscripción expirada: ${doc.id}`);
          await doc.ref.delete();
        } else {
          console.error('[Nora] Error en push:', error.message);
        }
      }
    });

    await Promise.all(promises);
  } catch (error) {
    console.error('[Nora] Error al obtener suscripciones de Firestore:', error);
  }
};
