import { tracked } from '@glimmer/tracking';
import { WorkerUrl } from './monte-carlo-worker';

const workers = [];
const NUM_WORKERS = 32;

let _subscriber = null;
const CBS = new Map();
for (let i = 0; i < NUM_WORKERS; i++) {
  const worker = new Worker(WorkerUrl);
  worker.addEventListener('message', (e) => {
    if (e.data === true) {
      CBS.get(worker).resolve();
    } else if (e.data === false) {
      // do nothing, worker shutdown
    } else {
      _subscriber(e);
    }
  });
  workers.push(worker);
}

function defer() {
  let resolve;
  const promise = new Promise((r) => (resolve = r));
  return { promise, resolve };
}

function startWorker(worker, year, count) {
  worker.postMessage(JSON.stringify({ name: 'start', year, count }));
  const deferred = defer();
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

  async run() {
    const { year } = this;
    let runs = 0;
    let results = [];

    const { groups, totalTickets, config } = year;
    const yearData = {
      year: year.year,
      groups: groups.map((g) => {
        return { ticketsPer: g.ticketsPer, applicants: g.applicants };
      }),
      totalTickets,
      config: { draws: config.draws, waitlistDraws: config.waitlistDraws },
    };
    yearData.groups.reverse();

    await Promise.resolve();

    let scheduled = false;

    _subscriber = (e) => {
      const data = e.data;
      const newRuns = data.shift();
      results = updateCount(year, runs, results, data, newRuns);
      runs += newRuns;

      if (!scheduled) {
        scheduled = defer();
        requestAnimationFrame(() => {
          setTimeout(() => {
            scheduled.resolve();
            scheduled = false;
            this.count = results;
            this.runs = runs;
          }, 0);
        });
      }
    };

    const promises = workers.map((worker) => {
      return /*#__NOINLINE__*/ startWorker(
        worker,
        yearData,
        Math.round(this.totalRuns / NUM_WORKERS)
      );
    });

    await Promise.all(promises);
    if (scheduled) {
      await scheduled.promise;
    }

    this.count = results.map((r) => {
      return {
        ticketsPer: r.ticketsPer,
        entered: Math.round(r.entered),
        waitlisted: Math.round(r.waitlisted),
      };
    });
    this.isComplete = true;
  }
}
