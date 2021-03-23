export interface StateFn {
	(): Promise<string>;
}

export interface StateMachine {
	[name: string]: StateFn;
}

export function start(machine: StateMachine, initial: string, recovery: string) {
	(async () => {
		let next = initial;
		let current: StateFn;

		while (true) {
			console.log("executing state", next);

			let current = machine[next];
			if (!current) {
				console.warn("failed to fetch state by name, transitioning to recovery state", next);
				next = recovery;
				continue;
			}

			try {
				next = await current();
			} catch (error) {
				console.warn("failed to execute state, transitioning to recovery state", next, error);
				next = recovery;
				continue;
			}
		}
	})()
}
