// Bootstrap inicial de CRM para una org nueva: crea pipeline default + 4 stages.
// Se invoca desde el register endpoint dentro de la misma transacción.
import { pipelines, stages } from '../../db/schema.js';
import { newId } from '../../lib/uuid.js';

const DEFAULT_STAGES = [
  { name: 'Lead',         position: 0, winProbability: 10 },
  { name: 'Calificado',   position: 1, winProbability: 25 },
  { name: 'Propuesta',    position: 2, winProbability: 50 },
  { name: 'Negociación',  position: 3, winProbability: 75 },
] as const;

export async function bootstrapDefaultPipeline(tx: any, orgId: Buffer) {
  const pipelineId = newId();
  await tx.insert(pipelines).values({
    id: pipelineId,
    orgId,
    name: 'Pipeline principal',
    isDefault: true,
  });
  for (const s of DEFAULT_STAGES) {
    await tx.insert(stages).values({
      id: newId(),
      pipelineId,
      name: s.name,
      position: s.position,
      winProbability: s.winProbability,
    });
  }
}
