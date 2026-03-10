export class OtherRunner {
  finish(): string {
    return 'other';
  }

  run(): string {
    return this.finish();
  }
}
