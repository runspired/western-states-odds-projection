const WorkerString = `
function getRandom(max) {
  return Math.round(Math.random() * max);
}
class Lottery {
  constructor(year) {
    this.year = year;
    this.totalTickets = year.totalTickets;
    const entrants = (this._entrants = []);
    year.groups.forEach((group) => {
      for (let i = 0; i < group.applicants; i++) {
        entrants.push(group.ticketsPer);
      }
    });
  }

  reset() {
    this.totalTickets = this.year.totalTickets;
    this.entrants = this._entrants.slice();
  }

  getTicket(num) {
    const { entrants } = this;
    let ticketPointer = 0;
    for (let i = 0; i < entrants.length; i++) {
      let entrant = entrants[i];
      if (ticketPointer + entrant < num) {
        ticketPointer += entrant;
        continue;
      }
      for (let j = 0; j < entrant; j++) {
        if (ticketPointer === num) {
          return { index: i, entrant };
        }
        ticketPointer++;
      }
    }
    // throw new Error(\`could not find ticket \${num}\`);
  }

  draw() {
    const { totalTickets } = this;
    const pulled = getRandom(totalTickets - 1);
    const winner = this.getTicket(pulled);

    return winner;
  }

  simulate() {
    this.reset();
    const { draws, waitlistDraws } = this.year.config;
    const totalDraws = draws + waitlistDraws;

    const entrants = {};
    const waitlist = {};

    for (let i = 0; i < totalDraws; i++) {
      const winner = this.draw();
      this.entrants.splice(winner.index, 1);
      this.totalTickets -= winner.entrant;
      if (i < draws) {
        entrants[winner.entrant] = entrants[winner.entrant] || 0;
        entrants[winner.entrant]++;
      } else {
        waitlist[winner.entrant] = waitlist[winner.entrant] || 0;
        waitlist[winner.entrant]++;
      }
    }

    return { entrants, waitlist };
  }
}

function weightedSum(count, old, update) {
  let sum = count * old + update;
  return Math.round((sum * 1000) / (count + 1)) / 1000;
}

function updateCount(year, count, prior, update) {
  return year.groups.map((group, index) => {
    if (count === 0) {
      return {
        ticketsPer: group.ticketsPer,
        entered: update.entrants[group.ticketsPer] || 0,
        waitlisted: update.waitlist[group.ticketsPer] || 0,
      };
    } else {
      let prev = prior[index];
      return {
        ticketsPer: group.ticketsPer,
        entered: weightedSum(
          count,
          prev.entered,
          update.entrants[group.ticketsPer] || 0
        ),
        waitlisted: weightedSum(
          count,
          prev.waitlisted,
          update.waitlist[group.ticketsPer] || 0
        ),
      };
    }
  });
}

async function breathe() {
  await new Promise((r) => setTimeout(r, 0));
}

class WorkerSimulator {
  constructor(year, count = 32) {
    this.year = year;
    this.runs = 0;
    this.totalRuns = count;
    this._count = null;
    this._isComplete = false;

    // console.log("Starting Worker for " + year.year, { runs: count });
    this.run();
  }

  get count() {
    return this._count;
  }
  set count(v) {
    // could probably use an array buffer to make this super fast
    const data = v.slice();
    data.push(this.runs);
    data.reverse();
    postMessage(data);
    this._count = v;
  }

  get isComplete() {
    return this._isComplete;
  }
  set isComplete(v) {
    postMessage(true);
    this._isComplete = v;
  }

  destroy() {
    this.totalRuns = 0;
    this.destroyed = true;
  }

  async run() {
    const { year } = this;
    let results = [];
    const lottery = new Lottery(year);
    for (let i = 0; i < this.totalRuns; i++) {
      const result = lottery.simulate();
      results = updateCount(year, this.runs, results, result);
      this.runs++;

      if (this.runs % 16 === 0) {
        await breathe();
        if (this.destroyed) {
          return;
        }
        this.count = results;
        results = [];
        this.runs = 0;
      }
    }
    if (this.runs % 16 !== 0) {
      this.count = results;
    }
    this.isComplete = true;
  }
}
let _simulation = null;

onmessage = (e) => {
  const data = JSON.parse(e.data);
  if (data.name === 'start') {
    if (_simulation) {
      _simulation.destroy();
      postMessage(false);
    }
    _simulation = new WorkerSimulator(data.year, data.count);
  }
};
`;

const WorkerBlob = new Blob([WorkerString], { type: 'text/javascript' });
export const WorkerUrl = URL.createObjectURL(WorkerBlob);
