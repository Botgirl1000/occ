import { UserService } from './service';

export function bootstrap(): string {
  const service = new UserService();
  return service.createUser('Ada');
}

bootstrap();
