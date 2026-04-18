import { app, configureApp } from '../server';

let isConfigured = false;

export default async (req: any, res: any) => {
  if (!isConfigured) {
    await configureApp();
    isConfigured = true;
  }
  return app(req, res);
};
