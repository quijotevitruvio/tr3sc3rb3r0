// Mount aggregator: monta todas las rutas del CRM bajo /api/crm/*.
import { Hono } from 'hono';
import { pipelineRoutes } from './routes/pipelines.js';
import { contactRoutes } from './routes/contacts.js';
import { companyRoutes } from './routes/companies.js';
import { dealRoutes } from './routes/deals.js';
import { noteRoutes } from './routes/notes.js';
import { taskRoutes } from './routes/tasks.js';
import { activityRoutes } from './routes/activities.js';
import { tagRoutes } from './routes/tags.js';
import { graphRoutes } from './routes/graph.js';

export const crmRoutes = new Hono();

crmRoutes.route('/pipelines', pipelineRoutes);
crmRoutes.route('/contacts', contactRoutes);
crmRoutes.route('/companies', companyRoutes);
crmRoutes.route('/deals', dealRoutes);
crmRoutes.route('/notes', noteRoutes);
crmRoutes.route('/tasks', taskRoutes);
crmRoutes.route('/activities', activityRoutes);
crmRoutes.route('/tags', tagRoutes);
crmRoutes.route('/graph', graphRoutes);
