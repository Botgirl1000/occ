export class Runner {
  finish(): string {
    return 'ok';
  }

  run(): string {
    return this.finish();
  }
}

export class ChildRunner extends Runner {
  runAgain(): string {
    return super.finish();
  }
}
