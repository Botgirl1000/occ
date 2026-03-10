import { saveUser as persistUser } from './utils';

export function aliasBootstrap(): string {
  return persistUser('Grace');
}
