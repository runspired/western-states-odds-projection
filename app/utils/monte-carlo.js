import { tracked } from '@glimmer/tracking';

function getRandom(max) {
  return Math.round(Math.random() * max);
}
class Lottery {
  constructor(year) {
    this.year = year;
    this.totalTickets = year.totalTickets;
    const entrants = (this._entrants = []);
    year.groups.forEach((group) => {
      const arr = new Array(group.applicants);
      arr.fill(group.ticketsPer);
      arr.forEach((ticketCount) => {
        const entrant = { ticketCount };

        entrants.push(entrant);
      });
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
      if (ticketPointer + entrant.ticketCount < num) {
        ticketPointer += entrant.ticketCount;
        continue;
      }
      for (let j = 0; j < entrant.ticketCount; j++) {
        if (ticketPointer === num) {
          return { index: i, entrant };
        }
        ticketPointer++;
      }
    }
    throw new Error(`could not find ticket ${num}`);
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

    const entrants = new Set();
    const waitlist = new Set();

    for (let i = 0; i < totalDraws; i++) {
      const winner = this.draw();
      this.entrants.splice(winner.index, 1);
      this.totalTickets -= winner.entrant.ticketCount;
      if (i < draws) {
        entrants.add(winner.entrant);
      } else {
        waitlist.add(winner.entrant);
      }
    }

    return { entrants, waitlist };
  }
}

function getCounts(winners) {
  const counts = {};
  winners.forEach((entrant) => {
    counts[entrant.ticketCount] = counts[entrant.ticketCount] || 0;
    counts[entrant.ticketCount]++;
  });
  return counts;
}

function weightedSum(count, old, update) {
  let sum = count * old + update;
  return Math.round((sum * 1000) / (count + 1)) / 1000;
}

function updateCount(year, count, prior, update) {
  const newEntrants = getCounts(update.entrants);
  const newWaitlist = getCounts(update.waitlist);
  const results = year.groups.map((group, index) => {
    if (count === 0) {
      return {
        ticketsPer: group.ticketsPer,
        entered: newEntrants[group.ticketsPer] || 0,
        waitlisted: newWaitlist[group.ticketsPer] || 0,
      };
    } else {
      let prev = prior[index];
      return {
        ticketsPer: group.ticketsPer,
        entered: weightedSum(
          count,
          prev.entered,
          newEntrants[group.ticketsPer] || 0
        ),
        waitlisted: weightedSum(
          count,
          prev.waitlisted,
          newWaitlist[group.ticketsPer] || 0
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

  year = null;

  constructor(year, count = 1000) {
    this.year = year;
    this.totalRuns = count;

    this.run();
  }

  async run() {
    const { year } = this;
    let results = [];
    const lottery = new Lottery(year);
    for (let i = 0; i < this.totalRuns; i++) {
      const result = lottery.simulate();
      results = updateCount(year, i, results, result);
      this.count = results;
      this.runs++;

      if (this.runs % 25 === 0) {
        await breath();
      }
    }
    this.count = results.map((r) => {
      return {
        ticketsPer: r.ticketsPer,
        entered: Math.round(r.entered),
        waitlisted: Math.round(r.waitlisted),
      };
    });
  }
}

async function breath() {
  await new Promise((r) => setTimeout(r, 0));
}
