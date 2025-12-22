import { KernelEngineRunner, type KernelEngineRunnerDeps } from './KernelEngineRunner';

let runner: KernelEngineRunner<any> | null = null;

export const KernelController = {
  configure<TIdentity>(deps: KernelEngineRunnerDeps<TIdentity>): KernelEngineRunner<TIdentity> {
    if (!runner) {
      runner = new KernelEngineRunner<TIdentity>(deps as any);
    } else {
      (runner as KernelEngineRunner<TIdentity>).setDeps(deps as any);
    }

    return runner as KernelEngineRunner<TIdentity>;
  },

  startAutonomyLoop() {
    runner?.startAutonomyLoop();
  },

  stopAutonomyLoop() {
    runner?.stopAutonomyLoop();
  },

  enqueueUserInput(userInput: string, imageData?: string) {
    runner?.enqueueUserInput(userInput, imageData);
  },

  reset() {
    runner?.stopAutonomyLoop();
    runner = null;
  }
};

export default KernelController;
