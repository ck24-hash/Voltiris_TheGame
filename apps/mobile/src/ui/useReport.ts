import type { CommandError } from '@voltiris/sim';
import { describeCommandError } from '../game/commandErrors';
import { useGame } from '../game/context';

/** Shows the sim's refusal as an error toast, or `done` as a notice. */
export function useReport() {
  const notify = useGame((s) => s.notify);
  return (error: CommandError | null, done: string) => {
    if (error) notify(describeCommandError(error), 'error');
    else notify(done);
  };
}
