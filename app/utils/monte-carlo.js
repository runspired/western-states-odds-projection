import { tracked } from '@glimmer/tracking';
import { WorkerUrl } from './monte-carlo-worker';

const CAP_ALLOC_LEN = 300_000_000;
const workers = [];
const NUM_WORKERS = 32;

let _subscriber = null;
let __shutdownSignal;
const CBS = new Map();

async function ensureWorkers() {
  if (workers.length) {
    return;
  }
  for (let i = 0; i < NUM_WORKERS; i++) {
    const worker = new Worker(WorkerUrl);
    worker.id = `${i + 1}`;
    worker.addEventListener('message', (e) => {
      const def = CBS.get(worker);
      if (e.data === true) {
        def.resolve();
      } else if (e.data === false) {
        if (def && def.prevStopped === false) {
          def.prevStopped = true;
          def.prev.reject('Run Cancelled');
          def.prev = null;
        }
      } else {
        if (_subscriber && def?.prevStopped) {
          _subscriber(e);
        }
      }
    });
    workers.push(worker);
  }
  await new Promise((resolve) => setTimeout(resolve, 100));
}
ensureWorkers();

function shutdownWorkers() {
  workers.forEach((worker) => worker.terminate());
  workers.length = 0;
}

function defer() {
  let resolve, reject;
  const promise = new Promise((r, rej) => {
    resolve = r;
    reject = rej;
  });
  return { promise, resolve, reject };
}

function shutdownWorker(worker) {
  CBS.delete(worker);
}

function startWorker(worker, year, count) {
  worker.postMessage({ name: 'start', year, count });
  const deferred = defer();
  const isRunning = CBS.get(worker);
  if (isRunning) {
    deferred.prevStopped = false;
    deferred.prev = isRunning;
  } else {
    deferred.prevStopped = true;
    deferred.prev = null;
  }
  CBS.set(worker, deferred);
  return deferred.promise;
}

function weightedSum(count, old, update, updateCount) {
  let sum = count * old + update * updateCount;
  return Math.round((sum * 1000) / (count + updateCount)) / 1000;
}

function updateCount(year, count, prior, update, updateCount) {
  const results = year.groups.map((group, index) => {
    if (count === 0) {
      return update[index];
    } else {
      let prev = prior[index];
      if (update[index].ticketsPer !== group.ticketsPer) {
        throw new Error(`Unexpected Mismatch`);
      }
      return {
        ticketsPer: group.ticketsPer,
        entered: weightedSum(
          count,
          prev.entered,
          update[index].entered,
          updateCount
        ),
        waitlisted: weightedSum(
          count,
          prev.waitlisted,
          update[index].waitlisted,
          updateCount
        ),
      };
    }
  });

  const total = {
    ticketsPer: 'Total',
    entered: Math.round(
      results.reduce((acc, val) => {
        return val.entered + acc;
      }, 0)
    ),
    waitlisted: Math.round(
      results.reduce((acc, val) => {
        return val.waitlisted + acc;
      }, 0)
    ),
  };
  results.push(total);

  return results;
}

export class Simulation {
  @tracked runs = 0;
  @tracked totalRuns = 0;
  @tracked count = null;
  @tracked isComplete = false;

  year = null;

  constructor(year, count = 1024) {
    this.year = year;
    this.totalRuns = count;

    this.run();
  }

  destroy() {
    _subscriber = null;
    if (this.scheduled) {
      cancelAnimationFrame(this.scheduled.raf);
      clearTimeout(this.scheduled.timer);
      this.scheduled.reject('Cancelled');
    }
    this.isDestroyed = true;
  }

  async run() {
    clearTimeout(__shutdownSignal);
    const { year } = this;
    let runs = 0;
    let results = [];

    const { groups, totalTickets, config, totalApplicants } = year;
    const yearData = {
      year: year.year,
      groups: groups.map((g) => {
        return { ticketsPer: g.ticketsPer, applicants: g.applicants };
      }),
      totalApplicants,
      totalTickets,
      config: { draws: config.draws, waitlistDraws: config.waitlistDraws },
    };
    yearData.groups.reverse();

    const useAllocApproach = totalTickets <= CAP_ALLOC_LEN;
    const ticketsBuf = useAllocApproach
      ? new SharedArrayBuffer(totalTickets * Uint32Array.BYTES_PER_ELEMENT)
      : null;
    const entrantsBuf = new SharedArrayBuffer(
      totalApplicants * Uint32Array.BYTES_PER_ELEMENT
    );
    const tickets = useAllocApproach ? new Uint32Array(ticketsBuf) : null;
    const entrants = new Uint32Array(entrantsBuf);
    let entrant = 0;
    let ticket = 0;
    yearData.groups.forEach((group) => {
      for (let i = 0; i < group.applicants; i++) {
        entrants[entrant] = group.ticketsPer;

        if (useAllocApproach) {
          for (let j = 0; j < group.ticketsPer; j++) {
            tickets[ticket] = entrant;
            ticket++;
          }
        }
        entrant++;
      }
    });
    yearData.entrants = entrantsBuf;
    yearData.tickets = useAllocApproach ? ticketsBuf : null;

    this.scheduled = false;

    _subscriber = (e) => {
      const data = e.data;
      const newRuns = data.shift();
      results = updateCount(year, runs, results, data, newRuns);
      runs += newRuns;

      if (!this.scheduled) {
        this.scheduled = defer();
        this.scheduled.raf = requestAnimationFrame(() => {
          this.scheduled.timer = setTimeout(() => {
            this.scheduled.resolve();
            this.scheduled = false;
            this.count = results;
            this.runs = runs;
          }, 0);
        });
      }
    };

    try {
      await ensureWorkers();
      const promises = workers.map((worker) => {
        return /*#__NOINLINE__*/ startWorker(
          worker,
          yearData,
          Math.round(this.totalRuns / NUM_WORKERS)
        );
      });

      await Promise.all(promises);
      workers.forEach(shutdownWorker);
      _subscriber = null;
      if (this.scheduled) {
        await this.scheduled.promise;
      }
      if (this.isDestroyed) {
        return;
      }

      this.count = results.map((r) => {
        return {
          ticketsPer: r.ticketsPer,
          entered: Math.round(r.entered),
          waitlisted: Math.round(r.waitlisted),
        };
      });
      this.isComplete = true;
      __shutdownSignal = setTimeout(shutdownWorkers, 15000);
    } catch (e) {
      console.log(e.message);
    }
  }
}
