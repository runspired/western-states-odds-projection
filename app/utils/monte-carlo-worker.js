const WorkerString = `
const CAP_ALLOC_LEN = 300_000_000;
function getRandom(max) {
  return Math.round(Math.random() * max);
}
function getTicket(entrants, num) {
  let ticketPointer = 0;
  for (let i = 0; i < entrants.length; i++) {
    let entrant = entrants[i];
    if (entrant === 0) {
      continue;
    }
    let te = ticketPointer + entrant;
    if (te < num) {
      ticketPointer = te;
      continue;
    }
    // num is in the bounds for this entrant
    entrants[i] = 0;
    return entrant;
  }
  throw new Error(\`could not find ticket \${num}\`);
}

function attemptDraw(entrants, tickets, totalTickets) {
  const pulled = getRandom(totalTickets - 1);
  const winnerIndex = tickets[pulled];
  const winner = entrants[winnerIndex];

  if (winner !== 0) {
    entrants[winnerIndex] = 0;
  }

  return winner;
}

function draw(entrants, tickets, count) {
  let winner = 0;

  if (count.abandonAlloc) {
    const pulled = getRandom(count.totalTickets - 1);
    const winner = getTicket(entrants, pulled);
    count.totalTickets -= winner;
    return winner;
  }

  while (winner === 0) {
    winner = attemptDraw(entrants, tickets, count.totalTickets);
  }

  return winner;
}

class Lottery {
  constructor(year) {
    this.year = year;
    this.totalTickets = year.totalTickets;
    this._entrants = new Uint32Array(year.entrants);
    this._tickets = CAP_ALLOC_LEN > year.totalTickets ? new Uint32Array(year.tickets) : null;
  }

  reset() {
    this.entrants = this._entrants.slice();
  }

  simulate() {
    this.reset();
    const { draws, waitlistDraws } = this.year.config;
    let totalDraws = draws + waitlistDraws;
    let { entrants, totalTickets, _tickets } = this;
    const ticketCount = { totalTickets, abandonAlloc: CAP_ALLOC_LEN <= totalTickets };
    if (entrants.length < totalDraws) {
      totalDraws = entrants.length;
    }

    const _entrants = {};
    const waitlist = {};

    for (let i = 0; i < totalDraws; i++) {
      const winner = draw(entrants, _tickets, ticketCount);
      if (i < draws) {
        _entrants[winner] = _entrants[winner] || 0;
        _entrants[winner]++;
      } else {
        waitlist[winner] = waitlist[winner] || 0;
        waitlist[winner]++;
      }
    }

    return { entrants: _entrants, waitlist };
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

function breathe() {
  return new Promise((r) => setTimeout(r, 0));
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
    _simulation = null;
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

      if (this.runs % 8 === 0) {
        await breathe();
        if (this.destroyed) {
          return;
        }
        this.count = results;
        results = [];
        this.runs = 0;
      }
    }
    if (this.runs % 8 !== 0) {
      this.count = results;
    }
    this.isComplete = true;
  }
}
let _simulation = null;

onmessage = (e) => {
  const data = e.data;
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
