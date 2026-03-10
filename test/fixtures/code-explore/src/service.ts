import { saveUser } from './utils';

export class BaseService {
  log(message: string): string {
    return message;
  }
}

export class UserService extends BaseService {
  createUser(name: string): string {
    const saved = saveUser(name);
    return this.log(saved);
  }
}
