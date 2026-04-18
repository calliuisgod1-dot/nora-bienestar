import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import { fileURLToPath } from 'url';
import cron from 'node-cron';
import admin from 'firebase-admin';
import { sendNotificationToAll } from './src/services/notificationService.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let firestore: admin.firestore.Firestore;

// Initialize Firebase Admin
async function initFirebase() {
  try {
    if (!admin.apps.length) {
      const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT;
      if (serviceAccount && serviceAccount.trim().startsWith('{')) {
        try {
          admin.initializeApp({
            credential: admin.credential.cert(JSON.parse(serviceAccount))
          });
          console.log(`[Bitácora DB] Firebase Admin OK (Service Account).`);
        } catch (parseError) {
          console.error("[Bitácora DB] Invalid Service Account JSON, falling back...");
          admin.initializeApp({
            projectId: process.env.FIREBASE_PROJECT_ID || 'nora-app-509ac'
          });
        }
      } else {
        admin.initializeApp({
          projectId: process.env.FIREBASE_PROJECT_ID || 'nora-app-509ac'
        });
        console.log(`[Bitácora DB] Firebase Admin OK (Project ID).`);
      }
    }
  } catch (e) {
    console.error("[Bitácora DB] Firebase initialization critical error:", e);
  }

  // Always try to get firestore instance, even if init failed (it might have initialized partially or before)
  try {
    firestore = admin.firestore();
  } catch (e) {
    console.error("[Bitácora DB] Could not obtain Firestore instance:", e);
  }
}

export const app = express();

export async function configureApp() {
  console.log("[Bitácora Cloud] Iniciando configuración...");
  await initFirebase();
  app.use(express.json());

  const subscriptionsColSnapshot = () => firestore ? firestore.collection('push_subscriptions') : null;

  app.get('/api/health', (req, res) => {
    res.json({ 
      status: 'ok', 
      db: firestore ? 'connected' : 'unavailable',
      engine: 'Nora Cloud', 
      time: new Date().toISOString() 
    });
  });

  app.post('/api/subscribe', async (req, res) => {
    const subscription = req.body;
    try {
      if (!subscription || !subscription.endpoint) return res.status(400).end();
      const col = subscriptionsColSnapshot();
      if (!col) return res.status(503).json({ error: 'Database Unavailable' });

      const id = Buffer.from(subscription.endpoint).toString('base64').substring(0, 100);
      await col.doc(id).set({
        ...subscription,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
      res.status(201).json({ status: 'success' });
    } catch (error) {
      console.error("Subscription error:", error);
      res.status(500).json({ error: 'Failed' });
    }
  });

  // Scheduled Jobs - Only in long-running process (not Netlify/Vercel)
  if (!process.env.NETLIFY && !process.env.VERCEL && false) {
    cron.schedule('0 9 * * *', () => {
      const messages = [
        "¡Buenos días, mi Karin! Hoy el cielo está despejado para ti. ¡A brillar! ✨",
        "¡Hola, mi cielo! Una nueva oportunidad para coleccionar millas brillantes. ¡Tú puedes!",
        "Despierta, mi Karin. Nora está lista para acompañarte hoy. Vamos con todo. ☀️"
      ];
      const message = messages[Math.floor(Math.random() * messages.length)];
      sendNotificationToAll('Bitácora de Nora', message).catch(console.error);
    }, { timezone: "Europe/Madrid" });
  }

  // Vite / Static
  if (process.env.NODE_ENV !== 'production' && !process.env.VERCEL) {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else if (!process.env.NETLIFY && !process.env.VERCEL) {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }
  
  return app;
}

// Separate logic flow for local/standalone vs. serverless
if (!process.env.NETLIFY && !process.env.VERCEL && process.env.NODE_ENV !== 'test') {
  configureApp()
    .then(() => {
      app.listen(3000, '0.0.0.0', () => {
        console.log(`[Bitácora Cloud] Nora online.`);
      });
    })
    .catch((err) => {
      console.error("[Bitácora Cloud] Critical Startup Error:", err);
      app.listen(3000, '0.0.0.0');
    });
} else {
  // Configured asynchronously by the serverless handler
}
