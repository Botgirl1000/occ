import path from 'node:path';
import { saveUser } from './utils';
import { missingThing } from './missing';

export function inspectDeps(name: string): string {
  return `${path.basename(saveUser(name))}:${missingThing}`;
}
