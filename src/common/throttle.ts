export function throttle(func: Function, timeout: number) {
  let ready: boolean = true;
  return (...args: any[]) => {
    if (!ready) {
      return;
    }

    ready = false;
    func(...args);
    setTimeout(() => {
      ready = true;
    }, timeout);
  };
}