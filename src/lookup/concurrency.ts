export function pLimit(concurrency: number): <T>(fn: () => Promise<T>) => Promise<T> {
  if (concurrency < 1) throw new Error('concurrency must be >= 1');
  let active = 0;
  const queue: Array<() => void> = [];
  const next = () => {
    if (active >= concurrency) return;
    const job = queue.shift();
    if (!job) return;
    active++;
    job();
  };
  return <T>(fn: () => Promise<T>) =>
    new Promise<T>((resolve, reject) => {
      queue.push(() => {
        fn().then(
          (v) => {
            active--;
            resolve(v);
            next();
          },
          (e) => {
            active--;
            reject(e);
            next();
          },
        );
      });
      next();
    });
}
